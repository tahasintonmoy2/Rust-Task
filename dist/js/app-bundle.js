(function () {
    'use strict';

    function getAttr(el, ...names) {
        if (names.length == 1) {
            return el.getAttribute(names[0]);
        }
        else {
            const vals = [];
            for (const name of names) {
                vals.push(el.getAttribute(name));
            }
            return vals;
        }
    }
    // implementation
    function setAttr(el, name_or_map, val) {
        const name = (typeof name_or_map == 'string') ? name_or_map : null;
        const map = (name === null) ? name_or_map : null;
        // if we have name, it's a solo setAttribute
        if (name !== null && val !== undefined) {
            _setAttribute(el, name, val);
        }
        else if (map != null && typeof map == 'object') {
            for (const [name, val] of Object.entries(map)) {
                _setAttribute(el, name, val);
            }
        }
        else {
            throw Error(`dom-native - setAttr call did not get the right arguments (el, ${name_or_map}, ${val})`);
        }
        return el;
    }
    function _setAttribute(el, name, val) {
        // if it is a boolean, true will set the attribute empty, and false will set txtVal to null, which will remove it.
        let txtVal = (typeof val !== 'boolean') ? val : (val === true) ? '' : null;
        if (txtVal !== null) {
            if (typeof txtVal !== 'string')
                txtVal = '' + txtVal;
            el.setAttribute(name, txtVal);
        }
        else {
            el.removeAttribute(name);
        }
    }
    // #endregion --- setAttr

    // --------- Object Utils --------- //
    // Make sure that this obj[propName] is a js Map and returns it. 
    // Otherwise, create a new one, set it, and return it.
    function ensureMap(obj, propName) {
        return _ensure(obj, propName, Map);
    }
    // Make sure that this obj[propName] is a js Set and returns it. 
    // Otherwise, create a new one, set it, and return it.
    function ensureSet(obj, propName) {
        return _ensure(obj, propName, Set);
    }
    // same as ensureMap but for array
    function ensureArray(obj, propName) {
        return _ensure(obj, propName, Array);
    }
    function _ensure(obj, propName, type) {
        const isMap = (obj instanceof Map);
        let v = (isMap) ? obj.get(propName) : obj[propName];
        if (v == null) {
            v = (type == null) ? {} : (type === Array) ? [] : (new type);
            if (isMap) {
                obj.set(propName, v);
            }
            else {
                obj[propName] = v;
            }
        }
        return v;
    }
    const emptyArray = Object.freeze([]);
    /**
     * Returns a readonly Node array from EventTarget, NodeList, Node[], or empty readonly array for null and undefined.
     */
    function asNodeArray(value) {
        if (value != null) {
            if (value instanceof Array) {
                return value;
            }
            // If it is a nodeList, copy the elements into a real array
            else if (value.constructor && value.constructor.name === "NodeList") {
                return Array.prototype.slice.call(value);
            }
            // FIXME: Needs to handle the document fragment case. 
            // otherwise we add value
            else {
                return [value]; // Note: here we assume it the evenTarget is a node
            }
        }
        // otherwise, return an empty array (readonly, so that we can )
        return emptyArray;
    }
    // --------- /asType --------- //
    // --------- String Utils --------- //
    function splitAndTrim(str, sep) {
        if (str == null) {
            return [];
        }
        if (str.indexOf(sep) === -1) {
            return [str.trim()];
        }
        return str.split(sep).map(trim);
    }
    function trim(str) {
        return str.trim();
    }

    function on(els, types, arg1, arg2, arg3) {
        let opts;
        let listener;
        let selector;
        // arg1 is a function, then no selector, arg1 is the listener, and arg2 is the potential eventOptions
        if (arg1 instanceof Function) {
            listener = arg1;
            opts = arg2;
        }
        else {
            selector = arg1;
            listener = arg2;
            opts = arg3;
        }
        // AddEventListenerOptions	
        let eventOptions;
        if (opts && (opts.passive != null || opts.capture != null)) {
            eventOptions = {};
            if (opts.passive != null) {
                eventOptions.passive = opts.passive;
            }
            if (opts.capture != null) {
                eventOptions.capture = opts.capture;
            }
        }
        if (els == null) {
            return;
        }
        const silenceDisconnectedCtx = opts === null || opts === void 0 ? void 0 : opts.silenceDisconnectedCtx;
        const ctx = opts === null || opts === void 0 ? void 0 : opts.ctx;
        const ctxEl = (ctx instanceof HTMLElement) ? ctx : undefined;
        const typeArray = splitAndTrim(types, ",");
        typeArray.forEach(function (type) {
            const typeSelectorKey = buildTypeSelectorKey(type, selector);
            asNodeArray(els).forEach(function (el) {
                // This will the listener use for the even listener, which might differ
                // from the listener function passed in case of a selector
                let _listener = listener;
                // if we have a selector, create the wrapper listener to do the matches on the selector
                if (selector) {
                    _listener = function (evt) {
                        let tgt = null;
                        const target = evt.target;
                        const currentTarget = evt.currentTarget;
                        const ctx = (opts) ? opts.ctx : null;
                        // if the 
                        if (silenceDisconnectedCtx === true && ctxEl != null) {
                            if (!ctxEl.isConnected) {
                                return;
                            }
                        }
                        // if the target match the selector, then, easy, we call the listener
                        if (target && target.matches(selector)) {
                            // Note: While mouseEvent are readonly for its properties, it does allow to add custom properties
                            // TODO: type narrowing needed.
                            evt.selectTarget = target;
                            listener.call(ctx, evt);
                        }
                        // now, if it does not, perhaps something in between the target and currentTarget
                        // might match
                        else {
                            // TODO: type narrowing needed.
                            tgt = evt.target.parentNode;
                            // TODO: might need to check that tgt is not undefined as well. 
                            while (tgt !== null && tgt !== currentTarget && tgt !== document) {
                                if (tgt.matches(selector)) { // selector is present here (see if above)
                                    // Note: While mouseEvent are readonly for its properties, it does allow to add custom properties
                                    evt.selectTarget = tgt;
                                    listener.call(ctx, evt);
                                    tgt = null;
                                    break;
                                }
                                tgt = tgt.parentNode;
                            }
                        }
                    };
                }
                // if we do not have a selector, but still havea  opts.ctx, then, need to wrap
                else if (opts && opts.ctx) {
                    _listener = function (evt) {
                        if (silenceDisconnectedCtx === true && ctxEl != null) {
                            if (!ctxEl.isConnected) {
                                return;
                            }
                        }
                        listener.call(opts.ctx, evt);
                    };
                }
                const listenerRef = {
                    type: type,
                    listener: listener,
                    _listener: _listener, // an eventual wrap of the listener, or just point listener.
                };
                if (selector) {
                    listenerRef.selector = selector;
                }
                // If we have a namespace, they add it to the Ref, and to the listenerRefsByNs
                // TODO: need to add listenerRef in a nsDic if if there a opts.ns
                if (opts && opts.ns) {
                    listenerRef.ns = opts.ns;
                    let listenerRefSetByNs = ensureMap(el, "listenerRefsByNs");
                    let listenerRefSet = ensureSet(listenerRefSetByNs, opts.ns);
                    listenerRefSet.add(listenerRef);
                }
                // add the listenerRef as listener:listenerRef entry for this typeSelectorKey in the listenerDic
                let listenerDic = ensureMap(el, "listenerDic");
                let listenerRefByListener = ensureMap(listenerDic, typeSelectorKey);
                listenerRefByListener.set(listener, listenerRef);
                // do the binding
                // TODO: fix typing here.
                if (opts != null && opts.nextFrame === true) {
                    requestAnimationFrame(function () {
                        el.addEventListener(type, _listener, eventOptions);
                    });
                }
                else {
                    el.addEventListener(type, _listener, eventOptions);
                }
            }); // /utils.asArray(els).forEach(function(el){
        }); // /types.forEach(function(type){
    }
    function off(els, type_or_opts, selector_or_listener, maybe_listener) {
        if (els == null) {
            return;
        }
        // for now, opts is only the first position
        const opts = (type_or_opts && type_or_opts.ns) ? type_or_opts : null;
        const type = (opts === null) ? type_or_opts : null;
        let selector = null;
        let listener;
        const tof = typeof selector_or_listener;
        if (tof === 'function') {
            selector = null;
            listener = selector_or_listener;
        }
        else if (tof === 'string') {
            selector = selector_or_listener;
            listener = maybe_listener;
        }
        // --------- off(els, {ns}) --------- //
        // if we have a .off(els,{ns:..}) then we do check only the ns
        if (opts && opts.ns) {
            const ns = opts.ns;
            asNodeArray(els).forEach(function (el) {
                const listenerDic = el.listenerDic;
                const listenerRefsByNs = el.listenerRefsByNs;
                let listenerRefSet;
                if (listenerRefsByNs && listenerDic) {
                    listenerRefSet = listenerRefsByNs.get(ns);
                    if (listenerRefSet) {
                        // if we get the set, we remove them all
                        listenerRefSet.forEach(function (listenerRef) {
                            // we remove the event listener
                            el.removeEventListener(listenerRef.type, listenerRef._listener);
                            // need to remove it from the listenerDic
                            const typeSelectorKey = buildTypeSelectorKey(listenerRef.type, listenerRef.selector);
                            const listenerRefMapByListener = listenerDic.get(typeSelectorKey);
                            if (listenerRefMapByListener && listenerRefMapByListener.has(listenerRef.listener)) {
                                listenerRefMapByListener.delete(listenerRef.listener);
                            }
                        });
                        // we remove this namespace now that all event handlers has been removed
                        listenerRefsByNs.delete(ns);
                    }
                }
            });
            return;
        }
        // --------- /off(els, {ns}) --------- //
        const typeSelectorKey = buildTypeSelectorKey(type, selector);
        asNodeArray(els).forEach(function (el) {
            // First, get the listenerRefByListener for this type/selectory
            const listenerRefMapByListener = (el.listenerDic) ? el.listenerDic.get(typeSelectorKey) : null; //val(el, ["listenerDic", typeSelectorKey]);
            // for now, if we do not have a listenerRef for this type/[selector], we throw an error
            if (!listenerRefMapByListener) {
                console.log("WARNING - Cannot do .off() since this type-selector '" + typeSelectorKey +
                    "' event was not bound with .on(). We will add support for this later.");
                return;
            }
            // if we do not have a listener function, this mean we need to remove all events for this type/selector
            if (typeof listener === "undefined" && type) {
                listenerRefMapByListener.forEach(function (listenerRef) {
                    // Note: Here, type === listenerRef.type
                    // remove the event
                    // TODO: check typing assumption
                    el.removeEventListener(type, listenerRef._listener);
                });
                el.listenerDic.delete(typeSelectorKey);
            }
            // if we have a listener, then, just remove this one.
            else {
                // check that we have the map. 
                const listenerRef = (listener) ? listenerRefMapByListener.get(listener) : null;
                if (!listenerRef) {
                    console.log("WARNING - Cannot do .off() since no listenerRef for " + typeSelectorKey +
                        " and function \n" + listener + "\n were found. Probably was not registered via on()");
                    return;
                }
                // remove the event
                // TODO: check typing assumption
                el.removeEventListener(type, listenerRef._listener);
                // remove it from the map
                // TODO: check typing ! assumption
                listenerRefMapByListener.delete(listener);
            }
        });
    }
    //#endregion ---------- /Public off API ---------- 
    //#region    ---------- Public trigger API ---------- 
    const customDefaultProps = {
        bubbles: true,
        cancelable: true
    };
    function trigger(els, type, evtInit) {
        if (els == null) {
            return;
        } // for now make it null/undefined proof
        asNodeArray(els).forEach(function (el) {
            const evt = new CustomEvent(type, Object.assign({}, customDefaultProps, { selectTarget: el }, evtInit));
            el.dispatchEvent(evt);
        });
    }
    //#endregion ---------- /Public trigger API ---------- 
    //#region    ---------- Public bindDOMEvents API ---------- 
    /**
     * Bind a list of bindings
     *
     * @param typeAndSelector e.g., `click` or `click; button.add`
     */
    function bindOnEvents(el, eventDics, opts) {
        eventDics = (eventDics instanceof Array) ? eventDics : [eventDics]; // make we have an array of eventDic
        for (const eventDic of eventDics) {
            for (const selector in eventDic) {
                bindOnEvent(el, selector, eventDic[selector], opts);
            }
        }
    }
    /**
     * Bind one event to a el by appropriately parsing the `typeAndSelector` might contains a selector;
     *
     * @param typeAndSelector e.g., `click` or `click; button.add`
     */
    function bindOnEvent(el, typeAndSelector, fn, opts) {
        let selectorSplitted = typeAndSelector.trim().split(";"); // e.g., ["click", " button.add"]
        let type = selectorSplitted[0].trim(); // e.g., "click"
        let selector = null; // e.g., "button.add"
        if (selectorSplitted.length > 1) {
            selector = selectorSplitted[1].trim();
        }
        on(el, type, selector, fn, opts);
    }
    //#endregion ---------- /Public bindDOMEvents API ---------- 
    function buildTypeSelectorKey(type, selector) {
        return (selector) ? (type + "--" + selector) : type;
    }

    function bindHubEvents(bindings, opts) {
        const bindingList = (bindings instanceof Array) ? bindings : [bindings];
        for (const bindings of bindingList) {
            const infoList = listHubInfos(bindings);
            infoList.forEach(function (info) {
                info.hub.sub(info.topics, info.labels, info.fun, opts);
            });
        }
    }
    /**
     * Unbinding a list of bindings. For now, MUST have nsObject.
     * @param bindings
     * @param nsObject
     */
    function unbindHubEvents(bindings, nsObject) {
        const bindingList = (bindings instanceof Array) ? bindings : [bindings];
        bindingList.forEach(function (hubEvents) {
            const infoList = listHubInfos(hubEvents);
            infoList.forEach(function (info) {
                info.hub.unsub(nsObject);
            });
        });
    }
    /**
     * @param {*} hubEvents could be {"hubName; topics[; labels]": fn}
     * 											or {hubName: {"topics[; labels]": fn}}
     * @returns {hub, topics, labels}[]
     */
    function listHubInfos(hubEvents) {
        const infoList = [];
        for (const key in hubEvents) {
            const val = hubEvents[key];
            // If we have FnBySelector, then, hub name is in the selector, getHubInfo will extract it
            // "hubName; topics[; labels]": fn}
            if (val instanceof Function) {
                infoList.push(getHubInfo(key, null, val));
            }
            // otherwise, if val is an object, then, thee key is the name of the hub, so get/create it.
            // {hubName: {"topics[; labels]": fn}}
            else {
                const _hub = hub(key);
                for (const key2 in val) {
                    infoList.push(getHubInfo(key2, _hub, val[key2]));
                }
            }
        }
        return infoList;
    }
    // returns {hub, topics, labels}
    // hub is optional, if not present, assume the name will be the first item will be in the str
    function getHubInfo(str, _hub, fun) {
        const a = splitAndTrim(str, ";");
        // if no hub, then, assume it is in the str
        const topicIdx = (_hub) ? 0 : 1;
        _hub = (!_hub) ? hub(a[0]) : _hub;
        const info = {
            topics: a[topicIdx],
            fun: fun,
            hub: _hub
        };
        if (a.length > topicIdx + 1) {
            info.labels = a[topicIdx + 1];
        }
        return info;
    }
    //#endregion ---------- /Private Helpers ---------- 
    //#region    ---------- Public Factory ---------- 
    /** Singleton hub factory */
    function hub(name) {
        if (name == null) {
            throw new Error('dom-native INVALID API CALLS: hub(name) require a name (no name was given).');
        }
        let hub = hubDic.get(name);
        // if it does not exist, we create and set it. 
        if (hub === undefined) {
            hub = new HubImpl(name);
            hubDic.set(name, hub);
            // create the hubData
            hubDataDic.set(name, new HubData(name));
        }
        return hub;
    }
    // User Hub object exposing the public API
    const hubDic = new Map();
    // Data for each hub (by name)
    const hubDataDic = new Map();
    class HubImpl {
        constructor(name) {
            this.name = name;
        }
        sub(topics, labels_or_handler, handler_or_opts, opts) {
            //// Build the arguments
            let labels;
            let handler;
            // if the first arg is function, then, no labels
            if (labels_or_handler instanceof Function) {
                labels = null;
                handler = labels_or_handler;
                opts = handler_or_opts;
            }
            else {
                labels = labels_or_handler;
                handler = handler_or_opts;
                // opts = opts;
            }
            //// Normalize topic and label to arrays
            const topicArray = splitAndTrim(topics, ",");
            const labelArray = (labels != null) ? splitAndTrim(labels, ",") : null;
            //// make opts (always defined at least an emtpy object)
            opts = makeOpts(opts);
            //// add the event to the hubData
            const hubData = hubDataDic.get(this.name); // by hub(...) factory function, this is garanteed
            hubData.addEvent(topicArray, labelArray, handler, opts);
        }
        unsub(ns) {
            const hubData = hubDataDic.get(this.name); // by factory contract, this always exist.
            hubData.removeRefsForNs(ns.ns);
        }
        pub(topics, labels, data) {
            // ARG SHIFTING: if data is undefined, we shift args to the RIGHT
            if (typeof data === "undefined") {
                data = labels;
                labels = null;
            }
            //// Normalize topic and label to arrays
            const topicArray = splitAndTrim(topics, ",");
            const labelArray = (labels != null) ? splitAndTrim(labels, ",") : null;
            const hubData = hubDataDic.get(this.name);
            const hasLabels = (labels != null && labels.length > 0);
            // if we have labels, then, we send the labels bound events first
            if (hasLabels) {
                hubData.getRefs(topicArray, labelArray).forEach(function (ref) {
                    invokeRef(ref, data);
                });
            }
            // then, we send the topic only bound
            hubData.getRefs(topicArray, null).forEach(function (ref) {
                // if this send, has label, then, we make sure we invoke for each of this label
                if (hasLabels) {
                    labelArray.forEach(function (label) {
                        invokeRef(ref, data, label);
                    });
                }
                // if we do not have labels, then, just call it.
                else {
                    invokeRef(ref, data);
                }
            });
        }
        deleteHub() {
            hubDic.delete(this.name);
            hubDataDic.delete(this.name);
        }
    }
    // TODO: This was maded to have it private to the hub. Now that we are using trypescript, we might want to use private and store it in the Hub. 
    class HubData {
        constructor(name) {
            this.refsByNs = new Map();
            this.refsByTopic = new Map();
            this.refsByTopicLabel = new Map();
            this.name = name;
        }
        addEvent(topics, labels, fun, opts) {
            const refs = buildRefs(topics, labels, fun, opts);
            const refsByNs = this.refsByNs;
            const refsByTopic = this.refsByTopic;
            const refsByTopicLabel = this.refsByTopicLabel;
            refs.forEach(function (ref) {
                // add this ref to the ns dictionary
                // TODO: probably need to add an custom "ns"
                if (ref.ns != null) {
                    ensureArray(refsByNs, ref.ns).push(ref);
                }
                // if we have a label, add this ref to the topicLabel dictionary
                if (ref.label != null) {
                    ensureArray(refsByTopicLabel, buildTopicLabelKey(ref.topic, ref.label)).push(ref);
                }
                // Otherwise, add it to this ref this topic
                else {
                    ensureArray(refsByTopic, ref.topic).push(ref);
                }
            });
        }
        ;
        getRefs(topics, labels) {
            const refs = [];
            const refsByTopic = this.refsByTopic;
            const refsByTopicLabel = this.refsByTopicLabel;
            topics.forEach(function (topic) {
                // if we do not have labels, then, just look in the topic dic
                if (labels == null || labels.length === 0) {
                    const topicRefs = refsByTopic.get(topic);
                    if (topicRefs) {
                        refs.push.apply(refs, topicRefs);
                    }
                }
                // if we have some labels, then, take those in accounts
                else {
                    labels.forEach(function (label) {
                        const topicLabelRefs = refsByTopicLabel.get(buildTopicLabelKey(topic, label));
                        if (topicLabelRefs) {
                            refs.push.apply(refs, topicLabelRefs);
                        }
                    });
                }
            });
            return refs;
        }
        ;
        removeRefsForNs(ns) {
            const refsByTopic = this.refsByTopic;
            const refsByTopicLabel = this.refsByTopicLabel;
            const refsByNs = this.refsByNs;
            const refs = this.refsByNs.get(ns);
            if (refs != null) {
                // we remove each ref from the corresponding dic
                refs.forEach(function (ref) {
                    // First, we get the refs from the topic or topiclabel
                    let refList;
                    if (ref.label != null) {
                        const topicLabelKey = buildTopicLabelKey(ref.topic, ref.label);
                        refList = refsByTopicLabel.get(topicLabelKey);
                    }
                    else {
                        refList = refsByTopic.get(ref.topic);
                    }
                    // Then, for the refList array, we remove the ones that match this object
                    let idx;
                    while ((idx = refList.indexOf(ref)) !== -1) {
                        refList.splice(idx, 1);
                    }
                });
                // we remove them all form the refsByNs
                refsByNs.delete(ns);
            }
        }
        ;
    }
    // static/private
    function buildRefs(topics, labels, fun, opts) {
        let refs = [];
        topics.forEach(function (topic) {
            // if we do not have any labels, then, just add this topic
            if (labels == null || labels.length === 0) {
                refs.push({
                    topic: topic,
                    fun: fun,
                    ns: opts.ns,
                    ctx: opts.ctx
                });
            }
            // if we have one or more labels, then, we add for those label
            else {
                labels.forEach(function (label) {
                    refs.push({
                        topic: topic,
                        label: label,
                        fun: fun,
                        ns: opts.ns,
                        ctx: opts.ctx
                    });
                });
            }
        });
        return refs;
    }
    // static/private: return a safe opts. If opts is a string, then, assume is it the {ns}
    const emptyOpts = {};
    function makeOpts(opts) {
        if (opts == null) {
            opts = emptyOpts;
        }
        else {
            if (typeof opts === "string") {
                opts = { ns: opts };
            }
        }
        return opts;
    }
    // static/private
    function buildTopicLabelKey(topic, label) {
        return topic + "-!-" + label;
    }
    // static/private: call ref method (with optional label override)
    function invokeRef(ref, data, label) {
        const info = {
            topic: ref.topic,
            label: ref.label || label,
            ns: ref.ns
        };
        ref.fun.call(ref.ctx, data, info);
    }
    //#endregion ---------- /Hub Implementation ----------

    const _onEventsByConstructor = new Map();
    const _computedOnDOMEventsByConstructor = new WeakMap();
    //#region    ---------- Public onEvent Decorator ---------- 
    function onEvent(type, selector_or_opts, opts) {
        return _onDOMEvent(null, type, selector_or_opts, opts);
    }
    function onDoc(type, selector_or_opts, opts) {
        return _onDOMEvent(document, type, selector_or_opts, opts);
    }
    function onWin(type, selector_or_opts, opts) {
        return _onDOMEvent(window, type, selector_or_opts, opts);
    }
    //#endregion ---------- /Public onEvent Decorator ---------- 
    // the decorator function
    function _onDOMEvent(evtTarget, type, selector_or_opts, opts) {
        let selector = (typeof selector_or_opts == 'string') ? selector_or_opts : null;
        opts = (selector === null) ? selector_or_opts : opts;
        // target references the element's class. It will be the constructor function for a static method or the prototype of the class for an instance member
        return function (target, propertyKey, descriptor) {
            descriptor.value;
            const clazz = target.constructor;
            // get the onEvents array for this clazz
            let onEvents = _onEventsByConstructor.get(clazz);
            if (onEvents == null) {
                onEvents = [];
                _onEventsByConstructor.set(clazz, onEvents);
            }
            // create and push the event
            const onEvent = {
                target: evtTarget,
                name: propertyKey,
                type: type,
                selector: selector,
                opts
            };
            onEvents.push(onEvent);
        };
    }
    /** Bind the element OnDOMEvent registred in the decorator _onDOMEvent  */
    function bindOnElementEventsDecorators(el) {
        const clazz = el.constructor;
        const computedOnDOMEvents = getComputeOnDOMEvents(clazz);
        if (computedOnDOMEvents != null) {
            const { elOnDOMEvents } = computedOnDOMEvents;
            if (elOnDOMEvents !== null) {
                const eventOpts = { ...el._nsObj, ctx: el };
                for (const onEvent of elOnDOMEvents) {
                    const target = (el.shadowRoot) ? el.shadowRoot : el;
                    const fn = el[onEvent.name];
                    _bindOn(target, onEvent, fn, eventOpts);
                }
            }
        }
    }
    function bindOnParentEventsDecorators(el) {
        const clazz = el.constructor;
        const computedOnDOMEvents = getComputeOnDOMEvents(clazz);
        const { docOnDOMEvents, winOnDOMEvents } = computedOnDOMEvents;
        const eventOpts = { ...el._nsObj, ctx: el, silenceDisconnectedCtx: true };
        if (docOnDOMEvents !== null) {
            for (const onEvent of docOnDOMEvents) {
                const fn = el[onEvent.name];
                _bindOn(onEvent.target, onEvent, fn, eventOpts);
            }
        }
        if (winOnDOMEvents !== null) {
            for (const onEvent of winOnDOMEvents) {
                const fn = el[onEvent.name];
                _bindOn(onEvent.target, onEvent, fn, eventOpts);
            }
        }
    }
    // Private bindOn. Here the target should be resolved before, won't take the onEvent.target
    function _bindOn(target, onEvent, fn, baseEventOpts) {
        let opts = baseEventOpts;
        if (onEvent.opts) {
            opts = { ...baseEventOpts, ...onEvent.opts };
        }
        on(target, onEvent.type, onEvent.selector, fn, opts);
    }
    // Return (and Compute if needed) the ComputedOnDOMEvents for a topClazz and store it in the 
    // Note: At this point, the parent classes will be process but their ComputedOnDOMEvents won't be computed.
    //       This could be a further optimization at some point, but not sure it will give big gain, since now this logic
    //       happen only one for the first instantiation of the class type object.
    function getComputeOnDOMEvents(clazz) {
        const alreadyComputed = _computedOnDOMEventsByConstructor.get(clazz);
        if (alreadyComputed) {
            return alreadyComputed;
        }
        const topClazz = clazz;
        const elOnDOMEvents = [];
        const docOnDOMEvents = [];
        const winOnDOMEvents = [];
        // Keep track of the `function_name` already bound by children classes to avoid double bind for the name function name.
        // This is the intuitive behavior, aligning with inheritance behavior.
        // This works because we are walking the hierarchy tree from child to parent.
        const childrenBoundFnNames = new Set();
        // --- Compute the ComputedOnDOMEvents
        do {
            const onEvents = _onEventsByConstructor.get(clazz);
            if (onEvents) {
                const clazzBoundFnNames = new Set();
                for (const onEvent of onEvents) {
                    const target = onEvent.target;
                    const fnName = onEvent.name;
                    // bind only if this function name was not already bound by a children
                    if (!childrenBoundFnNames.has(fnName)) {
                        // get the appropriate onDOMEvents list to push this event given the target
                        let onDOMEvents;
                        if (target === window) {
                            onDOMEvents = winOnDOMEvents;
                        }
                        else if (target === document) {
                            onDOMEvents = docOnDOMEvents;
                        }
                        else {
                            onDOMEvents = elOnDOMEvents;
                        }
                        onDOMEvents.push(onEvent);
                        // add the name to this class boundFnNames to be added to the childrenBoundFnNames later
                        clazzBoundFnNames.add(fnName);
                    }
                } // for onEvent of onEvents
                // add this class bound fnNames to the childrenBoudFnNames for next parent class resolution
                for (const fnName of clazzBoundFnNames) {
                    childrenBoundFnNames.add(fnName);
                }
            }
            // get the parent class
            // clazz = (<any>clazz).__proto__;
            clazz = Object.getPrototypeOf(clazz);
        } while (clazz !== HTMLElement);
        const computedOnDOMEvents = {
            elOnDOMEvents: elOnDOMEvents.length > 0 ? elOnDOMEvents : null,
            docOnDOMEvents: docOnDOMEvents.length > 0 ? docOnDOMEvents : null,
            winOnDOMEvents: winOnDOMEvents.length > 0 ? winOnDOMEvents : null,
        };
        _computedOnDOMEventsByConstructor.set(topClazz, computedOnDOMEvents);
        return computedOnDOMEvents;
    }
    function hasParentEventsDecorators(el) {
        const clazz = el.constructor;
        const computed = getComputeOnDOMEvents(clazz);
        return (computed.docOnDOMEvents != null || computed.winOnDOMEvents != null);
    }
    // only unbind docEvent and winEvent
    function unbindParentEventsDecorators(el) {
        const clazz = el.constructor;
        const computed = getComputeOnDOMEvents(clazz);
        if (computed.docOnDOMEvents != null) {
            off(document, el._nsObj);
        }
        if (computed.winOnDOMEvents != null) {
            off(window, el._nsObj);
        }
    }

    const _onHubEventByConstructor = new Map();
    const _computedOnHubEventByConstructor = new WeakMap();
    //#region    ---------- Public onEvent Decorator ---------- 
    /**
     * `onHub` decorator to bind a hub event to this instance.
     */
    function onHub(hubName, topic, label) {
        // target references the element's class. It will be the constructor function for a static method or the prototype of the class for an instance member
        return function (target, propertyKey, descriptor) {
            const clazz = target.constructor;
            // get the onEvents array for this clazz
            let onEvents = _onHubEventByConstructor.get(clazz);
            if (onEvents == null) {
                onEvents = [];
                _onHubEventByConstructor.set(clazz, onEvents);
            }
            // create and push the event
            const onEvent = {
                methodName: propertyKey,
                hubName,
                topic,
                label
            };
            onEvents.push(onEvent);
        };
    }
    //#endregion ---------- /Public onEvent Decorator ---------- 
    function hasHubEventDecorators(el) {
        return getComputedOnHubEvents(el.constructor) != null;
    }
    // For BaseHTMLElement
    function bindOnHubDecorators() {
        let clazz = this.constructor;
        const computed = getComputedOnHubEvents(clazz);
        if (computed != null) {
            const opts = { ...this._nsObj, ctx: this };
            for (const onEvent of computed) {
                const fnName = onEvent.methodName;
                const fn = this[fnName];
                const h = hub(onEvent.hubName);
                h.sub(onEvent.topic, onEvent.label, fn, opts);
            }
        }
    }
    // only unbind docEvent and winEvent
    function unbindOnHubDecorators() {
        let clazz = this.constructor;
        const computed = getComputedOnHubEvents(clazz);
        const nsObj = this._nsObj;
        if (computed != null) {
            for (const onEvent of computed) {
                const { hubName, methodName } = onEvent;
                const h = hub(hubName);
                h.unsub(nsObj);
            }
        }
    }
    function getComputedOnHubEvents(clazz) {
        const topClazz = clazz;
        const topClazzHubEvents = [];
        // keep track of the function name that were bound, to not double bind overriden parents
        // This is the intuitive behavior, aligning with inheritance behavior.
        const fnNameBoundSet = new Set();
        do {
            const onEvents = _onHubEventByConstructor.get(clazz);
            if (onEvents) {
                for (const onEvent of onEvents) {
                    const fnName = onEvent.methodName;
                    if (!fnNameBoundSet.has(fnName)) {
                        topClazzHubEvents.push(onEvent);
                        fnNameBoundSet.add(fnName);
                    }
                }
            }
            // clazz = (<any>clazz).__proto__;
            clazz = Object.getPrototypeOf(clazz);
        } while (clazz != HTMLElement);
        const computed = topClazzHubEvents.length > 0 ? topClazzHubEvents : null;
        _computedOnHubEventByConstructor.set(topClazz, computed);
        return computed;
    }

    // (c) 2019 BriteSnow, inc - This code is licensed under MIT license (see LICENSE for details)
    // component unique sequence number to allow to have cheap UID for each component
    let c_seq = 0;
    /**
     * BaseHTMLElement that all custom elements from this application should inherit from.
     *
     * SubClass Usage:
     *   - `init()` to create/modify the innerHTML/children, bind events. Must call `super.init()`
     *   - `this.uid` is the unique id for this component instance, so, can use to bind parent element events for later cleanup.
     *   - `disconnectedCallback()` to unbind any events bound to the parent of the component (document event binding). Must call `super.disconnectedCallback()`
     *
     * Important:
     *   - SubClass should/must override `init()` but never call `init()` from anywhere. Only `BaseHTMLElement.connectedCallback()` implementation should call `init()`
     *   - All calls to custom element interface `disconnectedCallback()` `connectedCallback()` `attributeChangedCallback()` MUST call their `super...` method.
     *
     */
    class BaseHTMLElement extends HTMLElement {
        constructor() {
            super();
            // lifecyle _init state
            this._init = false;
            this._parent_bindings_done = false;
            this._parent_unbindings_planned = false;
            this._hub_bindings_done = false;
            this._preDisplay_attached = false;
            this._postDisplay_attached = false;
            this.uid = 'c_uid_' + c_seq++;
            this._nsObj = { ns: this.uid };
        }
        get initialized() { return this._init; }
        /**
         * Method to override to create child elements. Will be called only once by the BaseHTMLElement `connectedCallback()` implementation.
         *
         * - Best Pratice: call `super.init()` when overriden.
         * - DO NOT call this method, this is called by BaseHTMLElement internal.
         *
         */
        init() { }
        /**
         * Base implementation of `connectedCallback` that will call `this.init()` once.
         *
         * - MUST call `super.connectedCallback()` when overriden.
         */
        connectedCallback() {
            const opts = { ns: this._nsObj.ns, ctx: this };
            if (this._has_parent_events == null) {
                this._has_parent_events = this.docEvents != null || this.winEvents != null || hasParentEventsDecorators(this);
            }
            // --- Bind the eventual parent events (document, windows)
            // Note: Parent events are silenced on when el is diconnected, and unbound when next frame still diconnected
            if (this._has_parent_events && !this._parent_bindings_done) {
                // bind the @docDoc event
                if (this.docEvents)
                    bindOnEvents(document, this.docEvents, { ...opts, silenceDisconnectedCtx: true });
                // bind the @docWin event
                if (this.winEvents)
                    bindOnEvents(window, this.winEvents, { ...opts, silenceDisconnectedCtx: true });
                bindOnParentEventsDecorators(this);
                this._parent_bindings_done = true;
            }
            // --- Bind the hub if not already done
            // Note: Hub events are bound and unbound on each connect and disconnect. 
            //       (could use the parent event optimation later)
            if (!this._hub_bindings_done) {
                if (this.hubEvents)
                    bindHubEvents(this.hubEvents, opts);
                bindOnHubDecorators.call(this);
                this._hub_bindings_done = true;
            }
            // --- Peform the init
            if (!this._init) {
                if (this.events)
                    bindOnEvents(this, this.events, opts);
                // bind the @onEvent decorated methods
                bindOnElementEventsDecorators(this);
                this.init();
                this._init = true;
            }
            // --- Register the eventual preDisplay / postDisplay
            // Note - Will pass the "firstCall" flag to both method. 
            if (this.preDisplay) {
                let firstCall = !(this._preDisplay_attached === true);
                requestAnimationFrame(() => {
                    this.preDisplay(firstCall);
                    this._preDisplay_attached = false;
                });
            }
            if (this.postDisplay) {
                let firstCall = !(this._postDisplay_attached === true);
                this._postDisplay_attached = true;
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        this.postDisplay(firstCall);
                        this._postDisplay_attached = false;
                    });
                });
            }
        }
        /**
         * Empty implementation to allow `super.disconnectedCallback()` best practices on sub classes
         */
        disconnectedCallback() {
            // NOTE: Here we detached
            if (this._has_parent_events === true) {
                requestAnimationFrame(() => {
                    if (!this.isConnected) {
                        if (this.docEvents) {
                            off(document, this._nsObj);
                        }
                        if (this.winEvents) {
                            off(window, this._nsObj);
                        }
                        unbindParentEventsDecorators(this);
                        this._parent_bindings_done = false;
                    }
                });
            }
            if (this.hubEvents || hasHubEventDecorators(this)) {
                if (this.hubEvents != null) {
                    unbindHubEvents(this.hubEvents, this._nsObj);
                }
                unbindOnHubDecorators.call(this);
                this._hub_bindings_done = false;
            }
        }
    }

    // inspired from https://github.com/Polymer/lit-element/blob/master/src/lib/css-tag.ts
    const supportsAdoptingStyleSheets = (window.ShadowRoot) &&
        ('adoptedStyleSheets' in Document.prototype)
        && ('replaceSync' in CSSStyleSheet.prototype);

    //#region    ---------- adoptStyle ---------- 
    /**
     * Adopt a cssObject on shadowRoot (use constructable stylesheets if browser support, or append(style) if not)
     * @param el - Host to a shadowRoot or the shadowRoot itself (throw exception if not supported)
     * @return el for chainability
     */
    function adoptStyleSheets(el, cssObject) {
        const shadow = isShadowRoot(el) ? el : el.shadowRoot;
        if (shadow == null) {
            throw new Error('DOM-NATIVE ERROR - Cannot adoptStyleSheets of a non shadowRoot or an element that does not have a shadowRoot');
        }
        const cssObjects = (cssObject instanceof Array) ? cssObject : [cssObject];
        if (supportsAdoptingStyleSheets) {
            const extShadow = shadow;
            extShadow.adoptedStyleSheets = [...extShadow.adoptedStyleSheets, ...cssObjects.map(co => co.sheet)];
        }
        else {
            shadow.append(...cssObjects.map(co => co.newStyle));
        }
        return el;
    }
    function isShadowRoot(el) {
        return (el.host != null && el.mode != null);
    }
    //#endregion ---------- /adoptStyle ---------- 
    //#region    ---------- css ---------- 
    const constructGuard = Symbol();
    // Note - use legacy way to do private for maximum Safari compatiblity (primary field was added 14.1 / 14.8, ~ 2021)
    const cssTextProp = Symbol();
    const styleRefProp = Symbol();
    const sheetProp = Symbol();
    /**
     *
     * CSSObject is the returned object from css tagged template or function call. It's immutable, and provides
     * getters to get style element from the cssText, or constructible CSSStyleSheet object (if supported by browser)
     *
     * This can be used as a stand alone utility, or with the  adoptStyle()
     */
    class CSSObject {
        constructor(cssText, guard) {
            if (guard !== constructGuard)
                throw new Error('Use css tag or css() to build a CSSObject');
            this[cssTextProp] = cssText;
        }
        get text() { return this[cssTextProp]; }
        ;
        /**
         * Returns a new style HTMLELement with the css text of this CSSObject
         * Note: (lazy created; cloned from reference style element )
         **/
        get newStyle() {
            var _a;
            (_a = this[styleRefProp]) !== null && _a !== void 0 ? _a : (this[styleRefProp] = Object.assign(document.createElement('style'), { innerHTML: this[cssTextProp] }));
            return this[styleRefProp].cloneNode(true);
        }
        /**
         * Returns the CSSStyleSheet (lazy created)
         *
         * NOTE: while the CSSObject.cssText is immutable, the returned sheet is not, and since it would not
         *            make sense to create a new sheet on each call (defeating its purpose), it is up to the user
         *            to have the appropriate strategy to mutate the returned sheet.
         *
         * NOTE: The sheet returned is only initialized once. The user is responsible to not mute it, or if muted, it is
         *       assumed the user wants it for all node that share this sheet (which is the point of shared sheet)
         **/
        get sheet() {
            if (supportsAdoptingStyleSheets) {
                if (this[sheetProp] == null) {
                    this[sheetProp] = new CSSStyleSheet();
                    this[sheetProp].replaceSync(this[cssTextProp]); // supportsAdoptingStyleSheets make sure this function exist
                }
                return this[sheetProp];
            }
            else {
                return null;
            }
        }
    }
    function css(strings, ...values) {
        let content;
        if (typeof strings === 'string') {
            content = strings.trim();
        }
        else {
            let r = '', i = 0, vl = values.length;
            for (; i < vl; i++) {
                const v = values[i];
                const vStr = (v instanceof CSSObject) ? v.text : v;
                r += strings[i] + vStr;
            }
            // add the last one
            r += strings[i];
            // make it null proof
            content = r;
        }
        return new CSSObject(content, constructGuard);
    }
    //#endregion ---------- /css ----------

    // private function to create a el with some eventual properties. 
    function elem(tagName, data) {
        let el = document.createElement(tagName);
        if (data != null) {
            for (const [name, rawVal] of Object.entries(data)) {
                // if it is a boolean, true will set the attribute empty, and false will set txtVal to null, which will remove it.
                const val = (typeof rawVal !== 'boolean') ? rawVal : (rawVal === true) ? '' : null;
                if (val !== null) {
                    const valTxt = (typeof val == 'string') ? val : ('' + val);
                    // "$" does a property assign of it's member
                    if (name == '$') {
                        const props = val;
                        for (const [name, rawVal] of Object.entries(props)) {
                            el[name] = rawVal;
                        }
                    }
                    else {
                        el.setAttribute(name, valTxt);
                    }
                }
                // if the value is null, we do nothing
            }
        }
        return el;
    }
    function html(strings, ...values) {
        var _a;
        let html;
        if (typeof strings === 'string') {
            html = strings.trim();
        }
        else {
            let r = '';
            for (let i = 0; i < strings.length; i++) {
                r += strings[i] + ((_a = values[i]) !== null && _a !== void 0 ? _a : '');
            }
            // make it null proof
            html = r;
        }
        const template = document.createElement("template");
        if (html) {
            template.innerHTML = html;
        }
        return template.content;
    }
    function frag(items, acc) {
        const frag = new DocumentFragment();
        if (items == null) {
            return frag;
        }
        for (const item of items) {
            const el = acc(item);
            frag.appendChild(el);
        }
        return frag;
    }

    function process_arg_el_selectors(el_or_selectors, maybe_selectors) {
        let selectors;
        let el;
        if (typeof el_or_selectors == "string") {
            maybe_selectors.unshift(el_or_selectors);
            selectors = maybe_selectors;
            el = document;
        }
        else if (Array.isArray(el_or_selectors)) {
            selectors = el_or_selectors;
            el = document;
        }
        else {
            selectors = maybe_selectors;
            el = el_or_selectors;
        }
        return [el, selectors];
    }
    function first(el_or_selectors, ...maybe_selectors) {
        let [el, selectors] = process_arg_el_selectors(el_or_selectors, maybe_selectors);
        const l = selectors.length;
        if (l == 0 || l == 1) {
            return _first(el, selectors[0]);
        }
        else {
            return selectors.map(sel => _first(el, sel));
        }
    }
    function getFirst(el_or_selectors, ...maybe_selectors) {
        let [el, selectors] = process_arg_el_selectors(el_or_selectors, maybe_selectors);
        if (el == null)
            throw new Error("dom-native - getFirst - requires el to not be null");
        const l = selectors.length;
        if (l == 0 || l == 1) {
            const res = _first(el, selectors[0]);
            if (res == null)
                throw new Error("dom-native - getFirst - element not found");
            return res;
        }
        else {
            const res = [];
            for (const sel of selectors) {
                const iel = _first(el, sel);
                if (iel == null)
                    throw new Error(`dom-native - getFirst - element for selector '${sel}' not found`);
                res.push(iel);
            }
            return res;
        }
    }
    function _first(el, selector) {
        if (el == null) {
            return null;
        }
        // We do not have a selector at all, then, this call is for firstElementChild
        if (selector == null) {
            return el.firstElementChild;
        }
        // otherwise, the call was either (selector) or (el, selector), so foward to the querySelector
        else {
            return _execQuerySelector(false, el, selector);
        }
    }
    function all(el, selector) {
        const nodeList = _execQuerySelector(true, el, selector);
        return (nodeList != null) ? asNodeArray(nodeList) : [];
    }
    // export function scanChild<A extends (TagName | String)[]>(el: Document | HTMLElement | DocumentFragment, ...tagNames: A): { [K in keyof A]: A[K] extends TagName ? HTMLElementTagNameMap[A[K]] : HTMLElement };
    function scanChild(el, ...tagNames) {
        if (el == null) {
            throw new Error(`dom-native - scanChild - requires el to not be null`);
        }
        const tagNamesLength = tagNames.length;
        const single = tagNamesLength == 1;
        // Note: Not sure this speed anything up.
        // const childrenCount = el.childElementCount;
        // if (childrenCount < tagNames.length) {
        // 	throw new Error("dom-native - scanChildren - node has less children than requested names");
        // }
        const result = (single) ? null : [];
        let nameIdx = 0;
        for (const child of el.children) {
            let name = tagNames[nameIdx].toUpperCase();
            if (child.tagName === name) {
                // return early if we have only one
                if (tagNamesLength == 1)
                    return child;
                // otherwise, add it to the result array
                result.push(child);
                nameIdx += 1;
            }
            if (nameIdx >= tagNamesLength) {
                break;
            }
        }
        if (result.length < tagNamesLength) {
            throw new Error("dom-native - scanChildren - node has less match children than requested");
        }
        return result;
    }
    function _execQuerySelector(all, elOrSelector, selector) {
        let el = null;
        // if el is null or undefined, means we return nothing. 
        if (elOrSelector == null) {
            return null;
        }
        // if selector is undefined, it means we select from document and el is the document
        if (typeof selector === "undefined") {
            selector = elOrSelector;
            el = document;
        }
        else {
            el = elOrSelector;
        }
        return (all) ? el.querySelectorAll(selector) : el.querySelector(selector);
    }
    // #endregion --- append

    document.createElement('div');
    document.createElement('e');

    const DEFAULT = { pos: 'TL', refPos: 'BR', gap: 0, x: true, y: true };
    function position$1(el, refElOrPoint, opts) {
        const _opts = { ...DEFAULT, ...opts }; // helping TS
        const { refPos: ref_pos, pos: el_pos, gap, vGap: _vGap, hGap: _hGap, x: axis_x, y: axis_y, constrain } = _opts;
        // Note: When no vGap or hGap given, 
        //       The value of the commong 'gap' property 
        //       is taken on if the axis is not centered (not "C")
        const vGap = _vGap !== null && _vGap !== void 0 ? _vGap : ((el_pos[0] != 'C') ? gap : 0);
        const hGap = _hGap !== null && _hGap !== void 0 ? _hGap : ((el_pos[1] != 'C') ? gap : 0);
        // --- Extract the eventual constrain
        let con_rec = null;
        if (constrain === undefined || constrain === window) {
            con_rec = { x: 0, y: 0, right: window.innerWidth, bottom: window.innerHeight };
        }
        else if (constrain instanceof Element) {
            con_rec = constrain.getBoundingClientRect();
        }
        // --- Compute the ref point
        let ref_point;
        if (refElOrPoint instanceof Element) {
            const ref_rec = refElOrPoint.getBoundingClientRect();
            ref_point = compute_ref_point(ref_rec, ref_pos);
        }
        else {
            ref_point = refElOrPoint;
        }
        // --- Compute the el position
        const el_rec = el.getBoundingClientRect();
        let pos_x = (typeof axis_x == 'number') ? axis_x : ((axis_x === true) ? compute_pos_x(ref_pos, ref_point, el_pos, el_rec, hGap) : el_rec.x);
        if (con_rec) {
            if (pos_x < con_rec.x) {
                pos_x = con_rec.x;
            }
            else if (pos_x + el_rec.width > con_rec.right) {
                pos_x = con_rec.right - el_rec.width;
            }
        }
        let pos_y = (typeof axis_y == 'number') ? axis_y : ((axis_y === true) ? compute_pos_y(ref_pos, ref_point, el_pos, el_rec, vGap) : el_rec.y);
        if (con_rec) {
            if (pos_y < con_rec.y) {
                pos_y = con_rec.y;
            }
            else if (pos_y + el_rec.height > con_rec.bottom) {
                pos_y = con_rec.bottom - el_rec.height;
            }
        }
        // Future - Will if overlap and execute overlap strategy
        // Note - We always on top left, because otherwise create uncessary dislodge on window resize.
        el.style.top = `${pos_y}px`;
        el.style.left = `${pos_x}px`;
    }
    function compute_ref_point(rec, pos) {
        let [pos_v, pos_h] = pos;
        let x = 0, y = 0;
        // x
        if (pos_h == 'L') {
            x = rec.left;
        }
        else if (pos_h == 'C') {
            x = rec.left + rec.width / 2;
        }
        else if (pos_h == 'R') {
            x = rec.right;
        }
        // ref_y
        if (pos_v == 'T') {
            y = rec.top;
        }
        else if (pos_v == 'C') {
            y = rec.top + rec.height / 2;
        }
        else if (pos_v == 'B') {
            y = rec.bottom;
        }
        return { x, y };
    }
    function compute_pos_x(ref, ref_point, pos, el_rec, gap) {
        const ref_x = ref_point.x;
        let pos_x = 0;
        let pos_h = pos[1];
        // pos_x
        if (pos_h == 'L') {
            pos_x = ref_x - el_rec.width - gap;
        }
        else if (pos_h == 'C') {
            pos_x = ref_x - el_rec.width / 2 - gap;
        }
        else if (pos_h == 'R') {
            pos_x = ref_x + gap;
        }
        return pos_x;
    }
    function compute_pos_y(ref, ref_point, pos, el_rec, gap) {
        const ref_y = ref_point.y;
        ref[0];
        let pos_y = 0;
        let pos_v = pos[0];
        // pos_y
        if (pos_v == 'T') {
            pos_y = ref_y - el_rec.height - gap;
        }
        else if (pos_v == 'C') {
            pos_y = ref_y - el_rec.height / 2 - gap;
        }
        else if (pos_v == 'B') {
            pos_y = ref_y + gap;
        }
        return pos_y;
    }

    // NOTE: If the implementation style... does not return 'T | null' then, the `return null;` says that does not match T (the guard seems to not work).
    //#endregion ---------- /style ----------
    //#region    ---------- className ---------- 
    /**
     * Minimilist DOM css class name helper. Add or Remove class name based on object property value.
     *
     * e.g., `className(el, {prime: true, 'dark-mode': false} )`
     *
     * - false | null means remove class name
     * - true | any defined object add class name
     * - undefined values will ignore the property name
     *
     * @returns pathrough return
     *
     * Examples:
     *   - `className(el, {prime: true, 'dark-mode': false} )` add css class 'prime' and remove 'dark-mode'
     *   - `className(el, {prime: someNonNullObject, 'dark-mode': false})` same as above.
     *   - `className(els, {prime: someNonNullObject, 'dark-mode': false})` Will add/remove class for all of the elements.
     *
     * @param el
     * @param keyValues e.g. `{prime: true, 'dark-mode': fase, 'compact-view': someObj}`
     */
    function className(els, keyValues) {
        if (els instanceof Array) {
            for (const el of els) {
                _setClassName(el, keyValues);
            }
        }
        else {
            _setClassName(els, keyValues);
        }
        return els;
    }
    function _setClassName(el, keyValues) {
        for (const name of Object.keys(keyValues)) {
            const val = keyValues[name];
            if (val === null || val === false) {
                el.classList.remove(name);
            }
            else if (val !== undefined) { // for now, do nothing if undefined
                el.classList.add(name);
            }
        }
    }
    //#endregion ---------- /className ----------

    function customElement(tagName) {
        // target references the element's class. 
        return function (target) {
            customElements.define(tagName, target);
        };
    }

    /******************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    function __decorate$1(decorators, target, key, desc) {
        var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
        if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
        else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
        return c > 3 && r && Object.defineProperty(target, key, r), r;
    }

    function __classPrivateFieldGet(receiver, state, kind, f) {
        if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
        if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
        return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
    }

    function __classPrivateFieldSet(receiver, state, value, kind, f) {
        if (kind === "m") throw new TypeError("Private method is not writable");
        if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
        if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
        return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
    }

    if (window.__decorate == null) {
        window.__decorate = __decorate$1;
    }
    class BaseFieldElement extends BaseHTMLElement {
        constructor() {
            super(...arguments);
            this._eventReady = false;
        }
        get eventReady() { return this._eventReady; }
        static get observedAttributes() { return ['disabled', 'readonly', 'placeholder', 'ico-lead']; }
        get readonly() { return this.hasAttribute('readonly'); }
        set readonly(v) { setAttr(this, 'readonly', (v) ? '' : null); }
        get disabled() { return this.hasAttribute('disabled'); }
        set disabled(v) { setAttr(this, 'disabled', (v) ? '' : null); }
        get dFocus() { return this.classList.contains('d-focus'); }
        set dFocus(v) { className(this, { 'd-focus': v }); }
        get name() { return getAttr(this, 'name'); }
        set name(v) { setAttr(this, 'name', v); }
        get placeholder() { return getAttr(this, 'placeholder'); }
        set placeholder(v) { setAttr(this, 'placeholder', v); }
        get iconLead() { return getAttr(this, 'icon-lead'); }
        get iconTrail() { return getAttr(this, 'icon-trail'); }
        get noValue() { return this.classList.contains('no-value'); }
        set noValue(v) { className(this, { 'no-value': v }); }
        init() {
            super.init();
            this.classList.add('d-field');
            on(this, 'focusin, focusout', evt => {
                switch (evt.type) {
                    case 'focusin':
                        this.dFocus = true;
                        break;
                    case 'focusout':
                        this.dFocus = false;
                        break;
                }
            });
            const [name, label] = getAttr(this, 'name', 'label');
            if (!label) {
                this.classList.add('no-label');
            }
            if (name && name.length > 0) {
                this.classList.add('dx');
            }
            requestAnimationFrame(() => {
                this._eventReady = true;
            });
        }
        attributeChangedCallback(attrName, oldVal, newVal) {
        }
        triggerChange() {
            if (this.initialized && this.eventReady) {
                const value = this.value;
                const name = this.name;
                trigger(this, "CHANGE", { detail: { name, value } });
            }
        }
    }

    var IcoElement_1;
    const { entries } = Object;
    function svgSymbolEl(name, attrs) {
        const el = html `<svg class="symbol ${name}">
  <use xlink:href="#${name}"></use>
</svg>
	`.firstElementChild;
        if (typeof attrs == 'object') {
            for (const [k, v] of entries(attrs)) {
                el.setAttribute(k, v);
            }
        }
        return el;
    }
    let SymbolElement = class SymbolElement extends BaseHTMLElement {
        static get observedAttributes() { return BaseFieldElement.observedAttributes.concat(['name']); }
        get name() { var _a; return (_a = this.getAttribute('name')) !== null && _a !== void 0 ? _a : ''; }
        init() {
            super.init();
            this.refresh();
        }
        attributeChangedCallback(attrName, oldVal, newVal) {
            switch (attrName) {
                case 'name':
                    if (oldVal !== newVal) {
                        this.classList.remove(oldVal);
                        this.refresh();
                    }
                    break;
            }
        }
        refresh() {
            const name = this.name;
            if (name) {
                this.classList.add(name);
                this.replaceChildren(svgSymbolEl(name));
            }
        }
    };
    SymbolElement = __decorate([
        customElement('d-symbol')
    ], SymbolElement);
    let IcoElement = IcoElement_1 = class IcoElement extends SymbolElement {
        get name() { return IcoElement_1.prefix + super.name; }
    };
    IcoElement.prefix = '';
    IcoElement = IcoElement_1 = __decorate([
        customElement('d-ico')
    ], IcoElement);

    const SHADOW_CONTENT$1 = html `
		<slot name="label"></slot>
		<slot name="visual"></slot>
`;
    class BaseToggleElement extends BaseFieldElement {
        constructor() {
            super();
            const shadow = this.attachShadow({ mode: 'open' });
            shadow.append(SHADOW_CONTENT$1.cloneNode(true));
        }
        static get observedAttributes() { return BaseFieldElement.observedAttributes.concat(['checked']); }
        get checked() { return this.hasAttribute('checked'); }
        set checked(v) { setAttr(this, { checked: v }); }
        get value() {
            const attrValue = getAttr(this, 'value');
            const checked = this.checked;
            if (attrValue) {
                return (checked) ? attrValue : false;
            }
            else {
                return checked;
            }
        }
        set value(v) {
            if (typeof v === 'boolean') {
                this.checked = v;
            }
            else {
                const attrValue = getAttr(this, 'value');
                if (attrValue) {
                    this.checked = (attrValue === v);
                }
                else {
                    console.log(`Warning - d-check - Tries to set a non boolean value '${v}' to checkElement.value which do not have a attribute value to match with. Skipping. `);
                }
            }
        }
        init() {
            super.init();
            this.setAttribute('tabindex', '0');
            const label = getAttr(this, 'label');
            if (label != null) {
                let labelEl = elem('label', { slot: 'label', $: { textContent: label } });
                this.appendChild(labelEl);
            }
            this.appendChild(this.renderVisualEl());
            on(this, 'pointerup', (evt) => {
                if (!this.disabled && !this.readonly) {
                    this.handleClick();
                }
            });
        }
        attributeChangedCallback(name, oldVal, newVal) {
            var _a;
            super.attributeChangedCallback(name, oldVal, newVal);
            if (this.initialized) {
                switch (name) {
                    case 'checked':
                        if (oldVal !== newVal) {
                            const visualEl = this.renderVisualEl();
                            if (visualEl) {
                                (_a = first(this, '[slot="visual"]')) === null || _a === void 0 ? void 0 : _a.remove();
                                this.appendChild(visualEl);
                            }
                            this.triggerChange();
                        }
                        break;
                }
            }
        }
    }

    let DCheckElement = class DCheckElement extends BaseToggleElement {
        handleClick() {
            this.checked = !this.checked;
        }
        renderVisualEl() {
            const icoName = (this.checked) ? 'd-ico-check-on' : 'd-ico-check-off';
            return svgSymbolEl(icoName, { slot: 'visual' });
        }
    };
    DCheckElement = __decorate([
        customElement("d-check")
    ], DCheckElement);

    const SHADOW_CONTENT = html `
	<slot name="icon-lead"></slot>
	<slot name="icon-trail"></slot>		
	<slot name="label"></slot>
	<slot name="label-trail"></slot>
	<slot name="text-trail"></slot>	
	<div class="box" part="box"></div>
`;
    class BaseInputElement extends BaseFieldElement {
        constructor() {
            super();
            const content = SHADOW_CONTENT.cloneNode(true);
            this.ctrlEl = this.createCtrlEl();
            setAttr(this.ctrlEl, { part: 'ctrl' });
            this.ctrlEl.classList.add('ctrl');
            content.appendChild(this.ctrlEl);
            const [readonly, disabled, placeholder] = getAttr(this, 'readonly', 'disabled', 'placeholder');
            if (isValueElement(this.ctrlEl)) {
                setAttr(this.ctrlEl, { readonly, disabled, placeholder });
            }
            const shadow = this.attachShadow({ mode: 'open' });
            shadow.append(content);
        }
        init() {
            super.init();
            const icoLead = this.iconLead;
            if (icoLead) {
                this.classList.add("has-icon-lead");
                this.appendChild(svgSymbolEl(icoLead, { slot: "icon-lead" }));
            }
            const icoTrail = this.iconTrail;
            if (icoTrail) {
                this.classList.add("has-icon-trail");
                this.appendChild(svgSymbolEl(icoTrail, { slot: "icon-trail" }));
            }
            const [label, labelTrail, textTrail] = getAttr(this, 'label', 'label-trail', 'text-trail');
            if (labelTrail) {
                this.appendChild(elem('label', { slot: 'label-trail', $: { textContent: labelTrail } }));
            }
            if (label) {
                this.appendChild(elem('label', { slot: 'label', $: { textContent: label } }));
            }
            if (textTrail) {
                this.classList.add("has-text-trail");
                this.appendChild(elem('div', { slot: 'text-trail', $: { textContent: textTrail } }));
            }
            const value = this.getInitialValue();
            this.noValue = (!value);
            this.value = value;
            on(this.ctrlEl, 'change, focusin, focusout', (evt) => {
                switch (evt.type) {
                    case 'focusin':
                        this.dFocus = true;
                        break;
                    case 'focusout':
                        this.dFocus = false;
                        break;
                    case 'change':
                        if (isValueElement(this.ctrlEl)) {
                            this.value = this.ctrlEl.value;
                        }
                        else {
                            this.value = this.textContent;
                        }
                        break;
                }
            });
            on(this.shadowRoot, 'click', 'label', (evt) => {
                this.ctrlEl.focus();
            });
        }
        attributeChangedCallback(name, oldVal, newVal) {
            super.attributeChangedCallback(name, oldVal, newVal);
            if (this.initialized) {
                switch (name) {
                    case 'readonly':
                        if (isValueElement(this.ctrlEl)) {
                            setAttr(this.ctrlEl, { readonly: newVal });
                        }
                        break;
                    case 'disabled':
                        if (isValueElement(this.ctrlEl)) {
                            setAttr(this.ctrlEl, { disabled: newVal });
                        }
                        break;
                    case 'placeholder':
                        if (isValueElement(this.ctrlEl)) {
                            setAttr(this.ctrlEl, { placeholder: newVal });
                        }
                        else {
                            this.value = this.value;
                        }
                        break;
                }
            }
        }
        focus() {
            var _a;
            (_a = this.ctrlEl) === null || _a === void 0 ? void 0 : _a.focus();
        }
    }
    function isValueElement(obj) {
        return (obj instanceof HTMLInputElement || obj instanceof HTMLTextAreaElement);
    }

    const _base_input_css = css `
	:host input, textarea {
		-webkit-appearance: none;
		-moz-appearance: none;
		padding-left: 0;
		padding-right: 0;		
	}
`;
    let DInputElement = class DInputElement extends BaseInputElement {
        constructor() {
            super();
            adoptStyleSheets(this, [_base_input_css]);
        }
        static get observedAttributes() { return BaseInputElement.observedAttributes.concat(['password']); }
        get value() { return this.ctrlEl.value; }
        ;
        set value(val) {
            const old = this.ctrlEl.value;
            if (val !== old) {
                this.ctrlEl.value = val;
            }
            const newVal = this.value;
            this.noValue = (!(newVal && newVal.length > 0));
            this.triggerChange();
        }
        ;
        init() {
            super.init();
        }
        createCtrlEl() {
            const type = this.hasAttribute('password') ? 'password' : 'text';
            return elem('input', { type });
        }
        getInitialValue() {
            return getAttr(this, 'value');
        }
    };
    DInputElement = __decorate([
        customElement("d-input")
    ], DInputElement);

    let DOptionElement = class DOptionElement extends BaseFieldElement {
        get value() {
            const selEl = first(this, '.d-ipt > div.sel');
            return (selEl) ? selEl.getAttribute('data-val') : null;
        }
        set value(val) {
            val = (typeof val !== 'string' && val != null) ? '' + val : val;
            const old = this.value;
            const items = all(this, '.d-ipt > div');
            for (const item of items) {
                if (item.getAttribute('data-val') === val) {
                    item.classList.add('sel');
                }
                else {
                    item.classList.remove('sel');
                }
            }
            if (val !== old) {
                this.triggerChange();
            }
        }
        init() {
            super.init();
            const [options, value] = getAttr(this, 'options', 'value');
            let html = '<div class="d-ipt">';
            if (options) {
                for (const line of options.split(',')) {
                    let [val, label] = line.split(':');
                    val = val.trim();
                    label = label.trim();
                    const sel = (value == val) ? 'sel' : '';
                    html += `  <div class="${sel}" data-val="${val}">${label}</div>\n`;
                }
                html += '</div>';
                this.innerHTML = html;
            }
            on(this, 'click', '.d-ipt > div', (evt) => {
                const clickedItem = evt.selectTarget;
                const val = clickedItem.getAttribute('data-val');
                this.value = val;
                this.triggerChange();
            });
        }
    };
    DOptionElement = __decorate([
        customElement('d-options')
    ], DOptionElement);

    const _shadow_css = css `

	::slotted(svg.symbol) {
		fill: var(--d-field-choice-bdr);
	}
	
	.d-ipt{
		width: 1.5rem;
		height: 1.5rem;
	}

	.d-ipt svg.symbol {
		fill: var(--d-field-choice-bdr);
	}

	:host([checked]) ::slotted(svg.symbol) {
		fill: var(--d-field-choice-bdr-on);
	}

`;
    let DRadioElement = class DRadioElement extends BaseToggleElement {
        constructor() {
            super();
            this.ignoreGroup = false;
            adoptStyleSheets(this, _shadow_css);
        }
        get checked() { return this.hasAttribute('checked'); }
        set checked(v) {
            if (!this.ignoreGroup) {
                const container = this.parentElement;
                if (container) {
                    const radios = all(container, `d-radio[name=${this.name}]`);
                    for (const radio of radios) {
                        if (radio != this && radio.checked) {
                            radio.ignoreGroup = true;
                            radio.checked = false;
                            radio.ignoreGroup = false;
                        }
                    }
                }
            }
            setAttr(this, { checked: v });
        }
        get value() {
            if (this.checked) {
                return super.value;
            }
            else {
                return undefined;
            }
        }
        set value(v) { super.value = v; }
        ;
        renderVisualEl() {
            const icoName = (this.checked) ? 'd-ico-radio-on' : 'd-ico-radio-off';
            return svgSymbolEl(icoName, { slot: 'visual' });
        }
        handleClick() {
            if (!this.checked) {
                this.checked = !this.checked;
            }
        }
    };
    DRadioElement = __decorate([
        customElement("d-radio")
    ], DRadioElement);

    const DEFAULT_GAP = 8;
    function position(el, opts) {
        var _a;
        const gap = (_a = opts.gap) !== null && _a !== void 0 ? _a : DEFAULT_GAP;
        const posObj = getPos(opts.to);
        const top_left = { top: -1, left: -1 };
        const rec = el.getBoundingClientRect();
        const refRec = opts.ref.getBoundingClientRect();
        if (posObj.type === 'h') {
            const pos = posObj.pos;
            const leftOnRight = refRec.right + gap;
            const leftOnLeft = refRec.left - gap - rec.width;
            const windowWidth = window.innerWidth;
            if (leftOnLeft < 0) {
                top_left.left = leftOnRight;
            }
            else if (leftOnRight + rec.width > windowWidth) {
                top_left.left = leftOnLeft;
            }
            else if (pos.loc === 'right') {
                top_left.left = leftOnRight;
            }
            else if (pos.loc === 'left') {
                top_left.left = leftOnLeft;
            }
            if (pos.align === 'top') {
                top_left.top = refRec.top;
            }
            else if (pos.align === 'bottom') {
                top_left.top = refRec.bottom;
            }
            else if (pos.align === 'center') {
                top_left.top = refRec.top + refRec.height / 2;
            }
        }
        else if (posObj.type === 'v') {
            const pos = posObj.pos;
            if (pos.loc === 'bottom') {
                top_left.top = refRec.bottom + gap;
            }
            else if (pos.loc === 'top') {
                top_left.top = refRec.top - gap - rec.height;
            }
            if (pos.align === 'left') {
                top_left.left = refRec.left;
            }
            else if (pos.align === 'right') {
                top_left.left = refRec.right - rec.width;
            }
            else if (pos.align === 'center') {
                top_left.left = refRec.left + (refRec.width / 2) - rec.width / 2;
            }
        }
        if (top_left.top + rec.height + 8 > window.innerHeight && top_left.top > top_left.top + rec.height + 8 - window.innerHeight) {
            top_left.top -= (top_left.top + rec.height + 8 - window.innerHeight);
        }
        el.style.top = top_left.top + 'px';
        el.style.left = top_left.left + 'px';
        if (opts.width != null && opts.width !== false) {
            const width = (opts.width === true) ? 0 : opts.width;
            el.style.width = `${refRec.width + width}px`;
        }
        if (opts.height != null && opts.height !== false) {
            const height = (opts.height === true) ? 0 : opts.height;
            el.style.height = `${refRec.height + height}px`;
        }
    }
    function getPos(to) {
        const loc = (typeof to === 'string') ? to : to.loc;
        if (loc === 'left' || loc === 'right') {
            const align = (typeof to !== 'string') ? to.align : 'top';
            return { type: 'h', pos: { loc, align } };
        }
        else if (loc === 'top' || loc === 'bottom') {
            const align = (typeof to !== 'string') ? to.align : 'left';
            return { type: 'v', pos: { loc, align } };
        }
        else {
            throw new Error(`Can't getPos from ${to}`);
        }
    }

    html `
	<slot name="icon-lead"></slot>
	<slot name="label"></slot>
	<div class="box" part="box"></div>
`;
    let DSelectElement = class DSelectElement extends BaseInputElement {
        constructor() {
            super();
            this.popupShowing = false;
            this.popupEl = null;
            this.options = [];
            this.shadowRoot.appendChild(elem('slot', { name: 'popup' }));
        }
        static get observedAttributes() { return BaseFieldElement.observedAttributes.concat(); }
        get popupCss() { return getAttr(this, 'popup-css'); }
        get value() {
            return this.textContent;
        }
        set value(v) {
            if (v == null && this.placeholder) {
                this.ctrlEl.part.add("placeholder");
                this.ctrlEl.textContent = this.placeholder;
            }
            else if (v != null) {
                this.part.remove("placeholder");
                this.ctrlEl.textContent = v;
            }
        }
        triggerData(sendData) {
            trigger(this, 'D-DATA', { detail: sendData });
        }
        onClick(evt) {
            var _a;
            if (!this.popupShowing && !this.disabled && !this.readonly) {
                let popupEl = elem('d-select-popup', { class: (_a = this.popupCss) !== null && _a !== void 0 ? _a : '' });
                popupEl._setupData = [this, this.options];
                document.body.appendChild(popupEl);
                this.popupShowing = true;
                on(popupEl, 'SELECT, CANCEL', (evt) => {
                    console.log('->> cancel');
                    if (evt.type === 'SELECT') {
                        this.value = evt.detail.value;
                        this.triggerChange();
                        this.refresh();
                    }
                    this.popupShowing = false;
                });
            }
        }
        init() {
            super.init();
            this.append(setAttr(svgSymbolEl('d-ico-chevron-down'), { slot: 'icon-trail' }));
            this.classList.add('has-icon-trail');
            console.log('->> d-select init');
        }
        refresh() {
        }
        createCtrlEl() {
            return elem('div');
        }
        getInitialValue() {
            return getAttr(this, 'value');
        }
    };
    __decorate([
        onEvent('pointerup')
    ], DSelectElement.prototype, "onClick", null);
    DSelectElement = __decorate([
        customElement('d-select')
    ], DSelectElement);
    const SELECT_POPUP_POSITION = Object.freeze({ loc: 'bottom', align: 'left' });
    let SelectPopupElement = class SelectPopupElement extends BaseHTMLElement {
        get selectEl() { return this._setupData[0]; }
        get selectOptions() { return this._setupData[1]; }
        removeOnScroll(evt) {
            this.discard(true);
        }
        onRepositionEvents(evt) {
            this.reposition();
        }
        onDocClick(evt) {
            if (!this.selectEl.contains(evt.target) && !this.contains(evt.target)) {
                this.discard(true);
            }
        }
        init() {
            this.reposition();
        }
        discard(cancel) {
            this.remove();
            if (cancel) {
                trigger(this, 'CANCEL');
            }
        }
        reposition() {
            const parentRect = this.selectEl.getBoundingClientRect();
            if (parentRect != null && !isSameRect(parentRect, this.previousSelectElRect)) {
                position(this, { ref: this.selectEl, to: SELECT_POPUP_POSITION, width: true });
            }
            this.previousSelectElRect = parentRect;
        }
    };
    __decorate([
        onDoc('scroll', { capture: true })
    ], SelectPopupElement.prototype, "removeOnScroll", null);
    __decorate([
        onWin('resize', { capture: true, passive: true })
    ], SelectPopupElement.prototype, "onRepositionEvents", null);
    __decorate([
        onDoc('pointerup')
    ], SelectPopupElement.prototype, "onDocClick", null);
    SelectPopupElement = __decorate([
        customElement('d-select-popup')
    ], SelectPopupElement);
    function isSameRect(a, b) {
        if (b == null)
            return false;
        return (a.top == b.top && a.left == b.left && a.right == b.right && a.bottom == b.bottom);
    }

    let DTextareaElement = class DTextareaElement extends BaseInputElement {
        get value() { return this.ctrlEl.value; }
        ;
        set value(val) {
            const old = this.value;
            if (val !== old) {
                this.ctrlEl.value = val;
            }
            const newVal = this.value;
            this.noValue = (!(newVal && newVal.length > 0));
            this.triggerChange();
        }
        ;
        createCtrlEl() {
            return elem('textarea');
        }
        getInitialValue() {
            for (let el of this.childNodes) {
                if (el.nodeType == Node.TEXT_NODE) {
                    const content = el.textContent;
                    if (content && content.trim().length > 0) {
                        return content;
                    }
                }
            }
            return getAttr(this, 'value');
        }
    };
    DTextareaElement = __decorate([
        customElement("d-textarea")
    ], DTextareaElement);

    const SVG_SYMBOLS = `
<svg xmlns="http://www.w3.org/2000/svg">
<symbol id="d-ico-check-off" viewBox="0 0 24 24"><g id="ico/" stroke="none" stroke-width="1" fill-rule="evenodd">
        <g id="d-ico/check-off" fill-rule="nonzero">
            <path d="M18.6666667,2 C20.5076158,2 22,3.49238417 22,5.33333333 L22,18.6666667 C22,20.5076158 20.5076158,22 18.6666667,22 L5.33333333,22 C3.49238417,22 2,20.5076158 2,18.6666667 L2,5.33333333 C2,3.49238417 3.49238417,2 5.33333333,2 L18.6666667,2 Z M18.8571429,4 L5.14285714,4 C4.55675904,4 4.0737061,4.44118879 4.00768884,5.00957586 L4,5.14285714 L4,18.8571429 C4,19.443241 4.44118879,19.9262939 5.00957586,19.9923112 L5.14285714,20 L18.8571429,20 C19.443241,20 19.9262939,19.5588112 19.9923112,18.9904241 L20,18.8571429 L20,5.14285714 C20,4.55675904 19.5588112,4.0737061 18.9904241,4.00768884 L18.8571429,4 Z" id="Rectangle-2"/>
        </g>
    </g></symbol>
<symbol id="d-ico-check-on" viewBox="0 0 24 24"><g id="ico/" stroke="none" stroke-width="1" fill-rule="evenodd">
        <g id="d-ico/check-on">
            <path d="M19,2 C20.6568542,2 22,3.34314575 22,5 L22,19 C22,20.6568542 20.6568542,22 19,22 L5,22 C3.34314575,22 2,20.6568542 2,19 L2,5 C2,3.34314575 3.34314575,2 5,2 L19,2 Z M18.2721849,6 L9.58538404,14.6785981 L6.16480239,11.2580164 L5,12.414616 L9.58538404,17 L19.4287845,7.15659955 L18.2721849,6 Z" id="Rectangle-2"/>
        </g>
    </g></symbol>
<symbol id="d-ico-chevron-down" viewBox="0 0 16 16"><g id="ico/" stroke="none" stroke-width="1" fill-rule="evenodd">
        <g id="d-ico/chevron-down" fill-rule="nonzero">
            <polygon id="Shape" points="3.41 5 8 9.59 12.59 5 14 6.42 8 12.42 2 6.42"/>
        </g>
    </g></symbol>
<symbol id="d-ico-chevron-right" viewBox="0 0 16 16"><g id="ico/" stroke="none" stroke-width="1" fill-rule="evenodd">
        <g id="d-ico/chevron-right">
            <polygon id="Shape" transform="translate(8.500000, 8.000000) rotate(-90.000000) translate(-8.500000, -8.000000) " points="3.91 4.5 8.5 8.83018868 13.09 4.5 14.5 5.83962264 8.5 11.5 2.5 5.83962264"/>
        </g>
    </g></symbol>
<symbol id="d-ico-fav" viewBox="0 0 24 24"><g id="ico/" stroke="none" stroke-width="1" fill-rule="evenodd">
        <g id="d-ico/fav" fill-rule="nonzero">
            <path d="M12,21.35 L10.55,20.03 C5.4,15.36 2,12.28 2,8.5 C2,5.42 4.42,3 7.5,3 C9.24,3 10.91,3.81 12,5.09 C13.09,3.81 14.76,3 16.5,3 C19.58,3 22,5.42 22,8.5 C22,12.28 18.6,15.36 13.45,20.04 L12,21.35 Z" id="Path"/>
        </g>
    </g></symbol>
<symbol id="d-ico-radio-off" viewBox="0 0 24 24"><g id="ico/" stroke="none" stroke-width="1" fill-rule="evenodd">
        <g id="d-ico/radio-off" fill-rule="nonzero">
            <path d="M12,2 C17.5228475,2 22,6.4771525 22,12 C22,17.5228475 17.5228475,22 12,22 C6.4771525,22 2,17.5228475 2,12 C2,6.4771525 6.4771525,2 12,2 Z M12,4 C7.581722,4 4,7.581722 4,12 C4,16.418278 7.581722,20 12,20 C16.418278,20 20,16.418278 20,12 C20,7.581722 16.418278,4 12,4 Z" id="Oval"/>
        </g>
    </g></symbol>
<symbol id="d-ico-radio-on" viewBox="0 0 24 24"><g id="ico/" stroke="none" stroke-width="1" fill-rule="evenodd">
        <g id="d-ico/radio-on" fill-rule="nonzero">
            <path d="M12,2 C17.5228475,2 22,6.4771525 22,12 C22,17.5228475 17.5228475,22 12,22 C6.4771525,22 2,17.5228475 2,12 C2,6.4771525 6.4771525,2 12,2 Z M12,4 C7.581722,4 4,7.581722 4,12 C4,16.418278 7.581722,20 12,20 C16.418278,20 20,16.418278 20,12 C20,7.581722 16.418278,4 12,4 Z M12,7 C14.7614237,7 17,9.23857625 17,12 C17,14.7614237 14.7614237,17 12,17 C9.23857625,17 7,14.7614237 7,12 C7,9.23857625 9.23857625,7 12,7 Z" id="Oval"/>
        </g>
    </g></symbol>
<symbol id="d-ico-star" viewBox="0 0 24 24"><g id="ico/" stroke="none" stroke-width="1" fill-rule="evenodd">
        <g id="d-ico/star" fill-rule="nonzero">
            <path d="M14.81,8.62 L12.92,4.17 C12.58,3.36 11.42,3.36 11.08,4.17 L9.19,8.63 L4.36,9.04 C3.48,9.11 3.12,10.21 3.79,10.79 L7.46,13.97 L6.36,18.69 C6.16,19.55 7.09,20.23 7.85,19.77 L12,17.27 L16.15,19.78 C16.91,20.24 17.84,19.56 17.64,18.7 L16.54,13.97 L20.21,10.79 C20.88,10.21 20.53,9.11 19.65,9.04 L14.81,8.62 Z" id="Shape"/>
        </g>
    </g></symbol>
<symbol id="d-ico-tick" viewBox="0 0 24 24"><g id="ico/" stroke="none" stroke-width="1" fill-rule="evenodd">
        <g id="d-ico/tick" fill-rule="nonzero">
            <polygon id="Path" points="8.2255884 16.7829562 3.58145537 12.1388232 2 13.7091416 8.2255884 19.93473 21.59 6.57031836 20.0196816 5"/>
        </g>
    </g></symbol>
<symbol id="d-ico-triangle-down" viewBox="0 0 16 16"><g id="ico/" stroke="none" stroke-width="1" fill-rule="evenodd">
        <g id="d-ico/triangle-down" fill-rule="nonzero">
            <polygon id="Shape" points="14 6 8 12 2 6"/>
        </g>
    </g></symbol>
<symbol id="d-ico-visible" viewBox="0 0 24 24"><g id="ico/" stroke="none" stroke-width="1" fill-rule="evenodd">
        <g id="d-ico/visible" fill-rule="nonzero">
            <path d="M12,4.5 C7,4.5 2.73,7.61 1,12 C2.73,16.39 7,19.5 12,19.5 C17,19.5 21.27,16.39 23,12 C21.27,7.61 17,4.5 12,4.5 Z M12,17 C9.24,17 7,14.76 7,12 C7,9.24 9.24,7 12,7 C14.76,7 17,9.24 17,12 C17,14.76 14.76,17 12,17 Z M12,9 C10.34,9 9,10.34 9,12 C9,13.66 10.34,15 12,15 C13.66,15 15,13.66 15,12 C15,10.34 13.66,9 12,9 Z" id="Shape"/>
        </g>
    </g></symbol>
</svg>
`;

    function loadDefaultIcons() {
        loadSvgSymbols(SVG_SYMBOLS);
    }
    function loadSvgSymbols(svgStr) {
        if (document.readyState === "complete"
            || document.readyState === "interactive") {
            inject_svg(svgStr);
        }
        else {
            document.addEventListener("DOMContentLoaded", async (event) => {
                inject_svg(svgStr);
            });
        }
    }
    function inject_svg(svg_str) {
        let svgEl = html(svg_str).firstElementChild;
        svgEl.setAttribute('style', 'display: none');
        document.head.append(svgEl);
    }

    var d$3=Object.defineProperty;var e=(c,a)=>{for(var b in a)d$3(c,b,{get:a[b],enumerable:!0});};

    var f$4={};e(f$4,{convertFileSrc:()=>w$1,invoke:()=>c$a,transformCallback:()=>s$8});function u$7(){return window.crypto.getRandomValues(new Uint32Array(1))[0]}function s$8(e,r=!1){let n=u$7(),t=`_${n}`;return Object.defineProperty(window,t,{value:o=>(r&&Reflect.deleteProperty(window,t),e==null?void 0:e(o)),writable:!1,configurable:!0}),n}async function c$a(e,r={}){return new Promise((n,t)=>{let o=s$8(i=>{n(i),Reflect.deleteProperty(window,`_${a}`);},!0),a=s$8(i=>{t(i),Reflect.deleteProperty(window,`_${o}`);},!0);window.__TAURI_IPC__({cmd:e,callback:o,error:a,...r});})}function w$1(e,r="asset"){let n=encodeURIComponent(e);return navigator.userAgent.includes("Windows")?`https://${r}.localhost/${n}`:`${r}://localhost/${n}`}

    async function a$4(i){return c$a("tauri",i)}

    var W$2={};e(W$2,{TauriEvent:()=>c$9,emit:()=>D$1,listen:()=>E$2,once:()=>_$2});async function s$7(n,t){return a$4({__tauriModule:"Event",message:{cmd:"unlisten",event:n,eventId:t}})}async function m$7(n,t,i){await a$4({__tauriModule:"Event",message:{cmd:"emit",event:n,windowLabel:t,payload:i}});}async function o$5(n,t,i){return a$4({__tauriModule:"Event",message:{cmd:"listen",event:n,windowLabel:t,handler:s$8(i)}}).then(r=>async()=>s$7(n,r))}async function u$6(n,t,i){return o$5(n,t,r=>{i(r),s$7(n,r.id).catch(()=>{});})}var c$9=(e=>(e.WINDOW_RESIZED="tauri://resize",e.WINDOW_MOVED="tauri://move",e.WINDOW_CLOSE_REQUESTED="tauri://close-requested",e.WINDOW_CREATED="tauri://window-created",e.WINDOW_DESTROYED="tauri://destroyed",e.WINDOW_FOCUS="tauri://focus",e.WINDOW_BLUR="tauri://blur",e.WINDOW_SCALE_FACTOR_CHANGED="tauri://scale-change",e.WINDOW_THEME_CHANGED="tauri://theme-changed",e.WINDOW_FILE_DROP="tauri://file-drop",e.WINDOW_FILE_DROP_HOVER="tauri://file-drop-hover",e.WINDOW_FILE_DROP_CANCELLED="tauri://file-drop-cancelled",e.MENU="tauri://menu",e.CHECK_UPDATE="tauri://update",e.UPDATE_AVAILABLE="tauri://update-available",e.INSTALL_UPDATE="tauri://update-install",e.STATUS_UPDATE="tauri://update-status",e.DOWNLOAD_PROGRESS="tauri://update-download-progress",e))(c$9||{});async function E$2(n,t){return o$5(n,null,t)}async function _$2(n,t){return u$6(n,null,t)}async function D$1(n,t){return m$7(n,void 0,t)}

    // --- Bridge Tauri HubEvent events to dom-native hub/pub/sub event
    //     (optional, but allows to use hub("Data").sub(..) or
    //      @onHub("Data", topic, label) on BaseHTMLElement custom elements)
    E$2("HubEvent", function (evt) {
        const hubEvent = evt.payload;
        // Get or create the Hub by name (from dom-native)
        //   (a Hub is a event bus namespace silo)
        let _hub = hub(hubEvent.hub);
        // Publish event to the given Hub
        if (hubEvent.label != null) {
            _hub.pub(hubEvent.topic, hubEvent.label, hubEvent.data);
        }
        else {
            _hub.pub(hubEvent.topic, hubEvent.data);
        }
    });

    // GENERATED BY SKETCHDEV
    const SYMBOLS = `
<svg xmlns="http://www.w3.org/2000/svg">
<symbol id="ico-add" viewBox="0 0 24.0 24.0"><g transform="translate(2.0 2.0)"><g><path d="M9.99,0 C15.52,0 20,4.48 20,10 C20,15.52 15.52,20 9.99,20 C4.47,20 0,15.52 0,10 C0,4.48 4.47,0 9.99,0 Z M10,2 C5.58,2 2,5.58 2,10 C2,14.42 5.58,18 10,18 C14.42,18 18,14.42 18,10 C18,5.58 14.42,2 10,2 Z M11,5 L11,9 L15,9 L15,11 L11,11 L11,15 L9,15 L9,11 L5,11 L5,9 L9,9 L9,5 L11,5 Z"/></g></g></symbol>
<symbol id="ico-c-left" viewBox="0 0 16.0 16.0"><g transform="translate(11.0 14.0) rotate(90.0) scale(-1.0 1.0)"><g><path d="M10.59,-1.67580834e-15 L12,1.33962264 L6,7 L0,1.33962264 L1.41,-1.67580834e-15 L6,4.33018868 L10.59,-1.67580834e-15 Z"/></g></g></symbol>
<symbol id="ico-c-right" viewBox="0 0 16.0 16.0"><g transform="translate(3.9999999999999996 14.0) rotate(-90.0)"><g><path d="M10.59,-1.67580834e-15 L12,1.33962264 L6,7 L0,1.33962264 L1.41,-1.67580834e-15 L6,4.33018868 L10.59,-1.67580834e-15 Z"/></g></g></symbol>
<symbol id="ico-close" viewBox="0 0 24.0 24.0"><g transform="translate(4.0 4.0)"><g><path d="M14.3885714,0 L16,1.61142857 L9.61142857,8 L16,14.3885714 L14.3885714,16 L8,9.61142857 L1.61142857,16 L0,14.3885714 L6.38857143,8 L0,1.61142857 L1.61142857,0 L8,6.38857143 L14.3885714,0 Z"/></g></g></symbol>
<symbol id="ico-handle" viewBox="0 0 24.0 24.0"><g transform="translate(7.0 3.0)"><g><path d="M3,14 L3,17 L0,17 L0,14 L3,14 Z M9,14 L9,17 L6,17 L6,14 L9,14 Z M3,7 L3,10 L0,10 L0,7 L3,7 Z M9,7 L9,10 L6,10 L6,7 L9,7 Z M3,0 L3,3 L0,3 L0,0 L3,0 Z M9,0 L9,3 L6,3 L6,0 L9,0 Z"/></g></g></symbol>
<symbol id="ico-image" viewBox="0 0 24.0 24.0"><g transform="translate(3.0 3.0)"><g><path d="M16,0 C17.1,0 18,0.9 18,2 L18,16 C18,17.1 17.1,18 16,18 L2,18 C0.9,18 0,17.1 0,16 L0,2 C0,0.9 0.9,0 2,0 Z M16,2 L2,2 L2,16 L16,16 L16,2 Z M11.14,8.86 L15,14 L3,14 L6,10.14 L8.14,12.73 L11.14,8.86 Z"/></g></g></symbol>
<symbol id="ico-menu" viewBox="0 0 24.0 24.0"><g transform="translate(3.0 6.0)"><g><path d="M18,10 L18,12 L0,12 L0,10 L18,10 Z M18,5 L18,7 L0,7 L0,5 L18,5 Z M18,0 L18,2 L0,2 L0,0 L18,0 Z"/></g></g></symbol>
<symbol id="ico-more" viewBox="0 0 24.0 24.0"><g transform="translate(14.999999999999998 22.0) rotate(-180.0)"><g><path d="M2.5,15 C3.875,15 5,16.125 5,17.5 C5,18.875 3.875,20 2.5,20 C1.125,20 0,18.875 0,17.5 C0,16.125 1.125,15 2.5,15 Z M2.5,7.5 C3.875,7.5 5,8.625 5,10 C5,11.375 3.875,12.5 2.5,12.5 C1.125,12.5 0,11.375 0,10 C0,8.625 1.125,7.5 2.5,7.5 Z M2.5,0 C3.875,0 5,1.125 5,2.5 C5,3.875 3.875,5 2.5,5 C1.125,5 0,3.875 0,2.5 C0,1.125 1.125,0 2.5,0 Z"/></g></g></symbol>
<symbol id="ico-search" viewBox="0 0 24.0 24.0"><g transform="translate(4.0 4.0)"><g><path d="M5.94101877,0 C6.7703348,0 7.54601962,0.157281716 8.26809651,0.471849866 C8.9901734,0.786418016 9.61930027,1.21179357 10.155496,1.74798928 C10.6916917,2.28418499 11.1170672,2.91331185 11.4316354,3.63538874 C11.7462035,4.35746563 11.9034853,5.12600129 11.9034853,5.94101877 C11.9034853,6.68454349 11.7748002,7.38516204 11.5174263,8.04289544 C11.2600523,8.70062885 10.9097431,9.29400987 10.4664879,9.8230563 L10.7238606,10.0589812 L11.4316354,10.0589812 L16,14.6487936 L14.6487936,16 L10.0589812,11.4316354 L10.0589812,10.7238606 L9.8230563,10.4664879 C9.29400987,10.9097431 8.70062885,11.2600523 8.04289544,11.5174263 C7.38516204,11.7748002 6.68454349,11.9034853 5.94101877,11.9034853 C5.12600129,11.9034853 4.35746563,11.7462035 3.63538874,11.4316354 C2.91331185,11.1170672 2.28418499,10.6916917 1.74798928,10.155496 C1.21179357,9.61930027 0.786418016,8.9901734 0.471849866,8.26809651 C0.157281716,7.54601962 0,6.7703348 0,5.94101877 C0,5.12600129 0.157281716,4.35746563 0.471849866,3.63538874 C0.786418016,2.91331185 1.21179357,2.28418499 1.74798928,1.74798928 C2.28418499,1.21179357 2.91331185,0.786418016 3.63538874,0.471849866 C4.35746563,0.157281716 5.12600129,0 5.94101877,0 Z M5.94101877,1.8230563 C4.81143314,1.8230563 3.84272075,2.22698434 3.03485255,3.03485255 C2.22698434,3.84272075 1.8230563,4.81143314 1.8230563,5.94101877 C1.8230563,7.08490295 2.22698434,8.05718992 3.03485255,8.85790885 C3.84272075,9.65862777 4.81143314,10.0589812 5.94101877,10.0589812 C7.08490295,10.0589812 8.05718992,9.65862777 8.85790885,8.85790885 C9.65862777,8.05718992 10.0589812,7.08490295 10.0589812,5.94101877 C10.0589812,4.81143314 9.65862777,3.84272075 8.85790885,3.03485255 C8.05718992,2.22698434 7.08490295,1.8230563 5.94101877,1.8230563 Z"/></g></g></symbol>
<symbol id="ico-settings" viewBox="0 0 24.0 24.0"><g transform="translate(2.0 2.0)"><g><path d="M11.7293316,0 C11.9793316,0 12.1893316,0.18 12.2293316,0.42 L12.5993316,3.07 C13.2293316,3.32 13.7693316,3.66 14.2893316,4.05 L16.7793316,3.05 C16.9993316,2.96 17.2693316,3.05 17.3893316,3.27 L19.3893316,6.73 C19.5093316,6.95 19.4593316,7.22 19.2693316,7.37 L17.1593316,9 C17.1993316,9.34 17.2293316,9.67 17.2293316,10 C17.2293316,10.33 17.1993316,10.65 17.1593316,10.97 L19.2693316,12.63 C19.4593316,12.78 19.5093316,13.05 19.3893316,13.27 L17.3893316,16.73 C17.2693316,16.95 16.9993316,17.03 16.7793316,16.95 L14.2893316,15.94 C13.7693316,16.34 13.2293316,16.67 12.5993316,16.93 L12.2293316,19.58 C12.1893316,19.82 11.9793316,20 11.7293316,20 L7.7293316,20 C7.4793316,20 7.2693316,19.82 7.2293316,19.58 L6.8593316,16.93 C6.2293316,16.68 5.6893316,16.34 5.1693316,15.94 L2.6793316,16.95 C2.4593316,17.03 2.1893316,16.95 2.0693316,16.73 L0.0693316039,13.27 C-0.0606683961,13.05 -0.000668396068,12.78 0.189331604,12.63 L2.2993316,10.97 C2.2593316,10.65 2.2293316,10.33 2.2293316,10 C2.2293316,9.67 2.2593316,9.34 2.2993316,9 L0.189331604,7.37 C-0.000668396068,7.22 -0.0606683961,6.95 0.0693316039,6.73 L2.0693316,3.27 C2.1893316,3.05 2.4593316,2.96 2.6793316,3.05 L5.1693316,4.05 C5.6893316,3.66 6.2293316,3.32 6.8593316,3.07 L7.2293316,0.42 C7.2693316,0.18 7.4793316,0 7.7293316,0 Z M9.7293316,6.5 C7.79633498,6.5 6.2293316,8.06700338 6.2293316,10 C6.2293316,11.9329966 7.79633498,13.5 9.7293316,13.5 C11.6623282,13.5 13.2293316,11.9329966 13.2293316,10 C13.2293316,8.06700338 11.6623282,6.5 9.7293316,6.5 Z"/></g></g></symbol>
<symbol id="ico-sync" viewBox="0 0 24.0 24.0"><g transform="translate(4.0 23.0) scale(1.0 -1.0)"><g><path d="M1.24,6.74 L2.7,8.2 C2.25,9.03 2,9.99 2,11 C2,14.31 4.69,17 8,17 L8,14 L12,18 L8,22 L8,19 C3.58,19 0,15.42 0,11 C0,9.43 0.46,7.97 1.24,6.74 Z M8,0 L8,3 C12.42,3 16,6.58 16,11 C16,12.57 15.54,14.03 14.76,15.26 L13.3,13.8 C13.75,12.97 14,12.01 14,11 C14,7.69 11.31,5 8,5 L8,8 L4,4 L8,0 Z"/></g></g></symbol>
<symbol id="ico-video" viewBox="0 0 24.0 24.0"><g transform="translate(3.0 6.0)"><g><path d="M13,0 C13.55,0 14,0.45 14,1 L14,4.5 L18,0.5 L18,11.5 L14,7.5 L14,11 C14,11.55 13.55,12 13,12 L1,12 C0.45,12 0,11.55 0,11 L0,1 C0,0.45 0.45,0 1,0 Z M12,2 L2,2 L2,10 L12,10 L12,2 Z"/></g></g></symbol>
</svg>
`;

    //#region    ---------- Helpers ---------- 
    const TYPE_OFFSET = 8;
    const TYPE_STRING = 'String]'; // '[object String]'
    const TYPE_OBJECT = 'Object]'; // '[object Object]'
    const TYPE_ARRAY = 'Array]'; // '[object Array]'
    const toType = Object.prototype.toString; // to call as toType(obj).substring(TYPE_OFFSET)
    function isEmpty(obj) {
        if (obj == null)
            return true;
        const type = toType.call(obj).substring(TYPE_OFFSET);
        if (type === TYPE_ARRAY) {
            return (obj.length === 0);
        }
        else if (type === TYPE_STRING) {
            if (obj.length === 0)
                return true;
            // needs to do the trim now
            return (obj.trim().length === 0);
        }
        else if (type === TYPE_OBJECT) {
            for (var prop in obj) {
                if (obj.hasOwnProperty(prop))
                    return false;
            }
            return true;
        }
        if (Number.isNaN(obj))
            return true;
        return false;
    }
    function pruneEmpty(obj, ...additionalExcludes) {
        return _prune(obj, isEmpty, additionalExcludes);
    }
    function _prune(obj, is, excludeVals) {
        if (obj == null)
            return obj;
        const excludeValSet = (excludeVals) ? new Set(excludeVals) : null;
        if (obj instanceof Array) {
            return obj.filter(v => !(is(v) || (excludeValSet === null || excludeValSet === void 0 ? void 0 : excludeValSet.has(v))));
        }
        else {
            // Should be Partial<T>, but TS does not like it. (any for now)
            // TODO: Needs to check if we can better type this.
            const prunedObj = {};
            for (const k in obj) {
                if (obj.hasOwnProperty(k)) {
                    const v = obj[k];
                    if (!(is(v) || (excludeValSet === null || excludeValSet === void 0 ? void 0 : excludeValSet.has(v)))) {
                        prunedObj[k] = v;
                    }
                }
            }
            return prunedObj;
        }
    }
    //#endregion ---------- /deepClone ---------- 
    // #region    --- deepFreeze
    /**
     * Very basic deep freeze function for 'data' objects and arrays.
     *
     * Few important assumptions are made:
     *
     * - Does not freeze properties of already frozen object. It's the correct assumption
     *   99.99% of the case, but important to know.
     *
     * - No cyclic reference handling. Use this function with simple tree like data object.
     *
     * For advanced immutability support, use immutable libraries such as immer.
     *
     * @param target Target value to be copied.
     * @see source project, ts-deepcopy https://github.com/ykdr2017/ts-deepcopy
     */
    function deepFreeze(obj) {
        if (Object.isFrozen(obj))
            return obj;
        // Retrieve the property names defined on object
        const propNames = Object.getOwnPropertyNames(obj);
        // Freeze properties before freezing self
        for (const name of propNames) {
            const value = obj[name];
            if (value != null && typeof value === "object") {
                deepFreeze(value);
            }
        }
        return Object.freeze(obj);
    }
    //#endregion ---------- /uuid ----------

    //! For now, manually written. Eventually could be automated. 
    function ensure_ModelMutateResultData(obj) {
        const keys = Object.keys(obj);
        if (keys.length != 1 || keys[0] != "id" || typeof obj["id"] !== "string") {
            throw new Error("assert ModelMutateResultData failed {obj}");
        }
        return obj;
    }

    var l$7={};e(l$7,{checkUpdate:()=>c$8,installUpdate:()=>f$3,onUpdaterEvent:()=>u$5});async function u$5(n){return E$2("tauri://update-status",e=>{n(e==null?void 0:e.payload);})}async function f$3(){let n;function e(){n&&n(),n=void 0;}return new Promise((a,i)=>{function o(r){if(r.error)return e(),i(r.error);if(r.status==="DONE")return e(),a()}u$5(o).then(r=>{n=r;}).catch(r=>{throw e(),r}),D$1("tauri://update-install").catch(r=>{throw e(),r});})}async function c$8(){let n;function e(){n&&n(),n=void 0;}return new Promise((a,i)=>{function o(t){return e(),a({manifest:t,shouldUpdate:!0})}function r(t){if(t.error)return e(),i(t.error);if(t.status==="UPTODATE")return e(),a({shouldUpdate:!1})}_$2("tauri://update-available",t=>{o(t==null?void 0:t.payload);}).catch(t=>{throw e(),t}),u$5(r).then(t=>{n=t;}).catch(t=>{throw e(),t}),D$1("tauri://update").catch(t=>{throw e(),t});})}

    var C$1={};e(C$1,{CloseRequestedEvent:()=>y$2,LogicalPosition:()=>c$7,LogicalSize:()=>m$6,PhysicalPosition:()=>o$4,PhysicalSize:()=>l$6,UserAttentionType:()=>W$1,WebviewWindow:()=>s$6,WebviewWindowHandle:()=>u$4,WindowManager:()=>h$2,appWindow:()=>b$2,availableMonitors:()=>T$2,currentMonitor:()=>E$1,getAll:()=>M$1,getCurrent:()=>f$2,primaryMonitor:()=>z$1});var m$6=class m{constructor(e,a){this.type="Logical";this.width=e,this.height=a;}},l$6=class l{constructor(e,a){this.type="Physical";this.width=e,this.height=a;}toLogical(e){return new m$6(this.width/e,this.height/e)}},c$7=class c{constructor(e,a){this.type="Logical";this.x=e,this.y=a;}},o$4=class o{constructor(e,a){this.type="Physical";this.x=e,this.y=a;}toLogical(e){return new c$7(this.x/e,this.y/e)}},W$1=(a=>(a[a.Critical=1]="Critical",a[a.Informational=2]="Informational",a))(W$1||{});function f$2(){return new s$6(window.__TAURI_METADATA__.__currentWindow.label,{skip:!0})}function M$1(){return window.__TAURI_METADATA__.__windows.map(i=>new s$6(i.label,{skip:!0}))}var P$1=["tauri://created","tauri://error"],u$4=class u{constructor(e){this.label=e,this.listeners=Object.create(null);}async listen(e,a){return this._handleTauriEvent(e,a)?Promise.resolve(()=>{let n=this.listeners[e];n.splice(n.indexOf(a),1);}):o$5(e,this.label,a)}async once(e,a){return this._handleTauriEvent(e,a)?Promise.resolve(()=>{let n=this.listeners[e];n.splice(n.indexOf(a),1);}):u$6(e,this.label,a)}async emit(e,a){if(P$1.includes(e)){for(let n of this.listeners[e]||[])n({event:e,id:-1,windowLabel:this.label,payload:a});return Promise.resolve()}return m$7(e,this.label,a)}_handleTauriEvent(e,a){return P$1.includes(e)?(e in this.listeners?this.listeners[e].push(a):this.listeners[e]=[a],!0):!1}},h$2=class h extends u$4{async scaleFactor(){return a$4({__tauriModule:"Window",message:{cmd:"manage",data:{label:this.label,cmd:{type:"scaleFactor"}}}})}async innerPosition(){return a$4({__tauriModule:"Window",message:{cmd:"manage",data:{label:this.label,cmd:{type:"innerPosition"}}}}).then(({x:e,y:a})=>new o$4(e,a))}async outerPosition(){return a$4({__tauriModule:"Window",message:{cmd:"manage",data:{label:this.label,cmd:{type:"outerPosition"}}}}).then(({x:e,y:a})=>new o$4(e,a))}async innerSize(){return a$4({__tauriModule:"Window",message:{cmd:"manage",data:{label:this.label,cmd:{type:"innerSize"}}}}).then(({width:e,height:a})=>new l$6(e,a))}async outerSize(){return a$4({__tauriModule:"Window",message:{cmd:"manage",data:{label:this.label,cmd:{type:"outerSize"}}}}).then(({width:e,height:a})=>new l$6(e,a))}async isFullscreen(){return a$4({__tauriModule:"Window",message:{cmd:"manage",data:{label:this.label,cmd:{type:"isFullscreen"}}}})}async isMaximized(){return a$4({__tauriModule:"Window",message:{cmd:"manage",data:{label:this.label,cmd:{type:"isMaximized"}}}})}async isDecorated(){return a$4({__tauriModule:"Window",message:{cmd:"manage",data:{label:this.label,cmd:{type:"isDecorated"}}}})}async isResizable(){return a$4({__tauriModule:"Window",message:{cmd:"manage",data:{label:this.label,cmd:{type:"isResizable"}}}})}async isVisible(){return a$4({__tauriModule:"Window",message:{cmd:"manage",data:{label:this.label,cmd:{type:"isVisible"}}}})}async theme(){return a$4({__tauriModule:"Window",message:{cmd:"manage",data:{label:this.label,cmd:{type:"theme"}}}})}async center(){return a$4({__tauriModule:"Window",message:{cmd:"manage",data:{label:this.label,cmd:{type:"center"}}}})}async requestUserAttention(e){let a=null;return e&&(e===1?a={type:"Critical"}:a={type:"Informational"}),a$4({__tauriModule:"Window",message:{cmd:"manage",data:{label:this.label,cmd:{type:"requestUserAttention",payload:a}}}})}async setResizable(e){return a$4({__tauriModule:"Window",message:{cmd:"manage",data:{label:this.label,cmd:{type:"setResizable",payload:e}}}})}async setTitle(e){return a$4({__tauriModule:"Window",message:{cmd:"manage",data:{label:this.label,cmd:{type:"setTitle",payload:e}}}})}async maximize(){return a$4({__tauriModule:"Window",message:{cmd:"manage",data:{label:this.label,cmd:{type:"maximize"}}}})}async unmaximize(){return a$4({__tauriModule:"Window",message:{cmd:"manage",data:{label:this.label,cmd:{type:"unmaximize"}}}})}async toggleMaximize(){return a$4({__tauriModule:"Window",message:{cmd:"manage",data:{label:this.label,cmd:{type:"toggleMaximize"}}}})}async minimize(){return a$4({__tauriModule:"Window",message:{cmd:"manage",data:{label:this.label,cmd:{type:"minimize"}}}})}async unminimize(){return a$4({__tauriModule:"Window",message:{cmd:"manage",data:{label:this.label,cmd:{type:"unminimize"}}}})}async show(){return a$4({__tauriModule:"Window",message:{cmd:"manage",data:{label:this.label,cmd:{type:"show"}}}})}async hide(){return a$4({__tauriModule:"Window",message:{cmd:"manage",data:{label:this.label,cmd:{type:"hide"}}}})}async close(){return a$4({__tauriModule:"Window",message:{cmd:"manage",data:{label:this.label,cmd:{type:"close"}}}})}async setDecorations(e){return a$4({__tauriModule:"Window",message:{cmd:"manage",data:{label:this.label,cmd:{type:"setDecorations",payload:e}}}})}async setAlwaysOnTop(e){return a$4({__tauriModule:"Window",message:{cmd:"manage",data:{label:this.label,cmd:{type:"setAlwaysOnTop",payload:e}}}})}async setSize(e){if(!e||e.type!=="Logical"&&e.type!=="Physical")throw new Error("the `size` argument must be either a LogicalSize or a PhysicalSize instance");return a$4({__tauriModule:"Window",message:{cmd:"manage",data:{label:this.label,cmd:{type:"setSize",payload:{type:e.type,data:{width:e.width,height:e.height}}}}}})}async setMinSize(e){if(e&&e.type!=="Logical"&&e.type!=="Physical")throw new Error("the `size` argument must be either a LogicalSize or a PhysicalSize instance");return a$4({__tauriModule:"Window",message:{cmd:"manage",data:{label:this.label,cmd:{type:"setMinSize",payload:e?{type:e.type,data:{width:e.width,height:e.height}}:null}}}})}async setMaxSize(e){if(e&&e.type!=="Logical"&&e.type!=="Physical")throw new Error("the `size` argument must be either a LogicalSize or a PhysicalSize instance");return a$4({__tauriModule:"Window",message:{cmd:"manage",data:{label:this.label,cmd:{type:"setMaxSize",payload:e?{type:e.type,data:{width:e.width,height:e.height}}:null}}}})}async setPosition(e){if(!e||e.type!=="Logical"&&e.type!=="Physical")throw new Error("the `position` argument must be either a LogicalPosition or a PhysicalPosition instance");return a$4({__tauriModule:"Window",message:{cmd:"manage",data:{label:this.label,cmd:{type:"setPosition",payload:{type:e.type,data:{x:e.x,y:e.y}}}}}})}async setFullscreen(e){return a$4({__tauriModule:"Window",message:{cmd:"manage",data:{label:this.label,cmd:{type:"setFullscreen",payload:e}}}})}async setFocus(){return a$4({__tauriModule:"Window",message:{cmd:"manage",data:{label:this.label,cmd:{type:"setFocus"}}}})}async setIcon(e){return a$4({__tauriModule:"Window",message:{cmd:"manage",data:{label:this.label,cmd:{type:"setIcon",payload:{icon:typeof e=="string"?e:Array.from(e)}}}}})}async setSkipTaskbar(e){return a$4({__tauriModule:"Window",message:{cmd:"manage",data:{label:this.label,cmd:{type:"setSkipTaskbar",payload:e}}}})}async setCursorGrab(e){return a$4({__tauriModule:"Window",message:{cmd:"manage",data:{label:this.label,cmd:{type:"setCursorGrab",payload:e}}}})}async setCursorVisible(e){return a$4({__tauriModule:"Window",message:{cmd:"manage",data:{label:this.label,cmd:{type:"setCursorVisible",payload:e}}}})}async setCursorIcon(e){return a$4({__tauriModule:"Window",message:{cmd:"manage",data:{label:this.label,cmd:{type:"setCursorIcon",payload:e}}}})}async setCursorPosition(e){if(!e||e.type!=="Logical"&&e.type!=="Physical")throw new Error("the `position` argument must be either a LogicalPosition or a PhysicalPosition instance");return a$4({__tauriModule:"Window",message:{cmd:"manage",data:{label:this.label,cmd:{type:"setCursorPosition",payload:{type:e.type,data:{x:e.x,y:e.y}}}}}})}async setIgnoreCursorEvents(e){return a$4({__tauriModule:"Window",message:{cmd:"manage",data:{label:this.label,cmd:{type:"setIgnoreCursorEvents",payload:e}}}})}async startDragging(){return a$4({__tauriModule:"Window",message:{cmd:"manage",data:{label:this.label,cmd:{type:"startDragging"}}}})}async onResized(e){return this.listen("tauri://resize",e)}async onMoved(e){return this.listen("tauri://move",e)}async onCloseRequested(e){return this.listen("tauri://close-requested",a=>{let n=new y$2(a);Promise.resolve(e(n)).then(()=>{if(!n.isPreventDefault())return this.close()});})}async onFocusChanged(e){let a=await this.listen("tauri://focus",d=>{e({...d,payload:!0});}),n=await this.listen("tauri://blur",d=>{e({...d,payload:!1});});return ()=>{a(),n();}}async onScaleChanged(e){return this.listen("tauri://scale-change",e)}async onMenuClicked(e){return this.listen("tauri://menu",e)}async onFileDropEvent(e){let a=await this.listen("tauri://file-drop",r=>{e({...r,payload:{type:"drop",paths:r.payload}});}),n=await this.listen("tauri://file-drop-hover",r=>{e({...r,payload:{type:"hover",paths:r.payload}});}),d=await this.listen("tauri://file-drop-cancelled",r=>{e({...r,payload:{type:"cancel"}});});return ()=>{a(),n(),d();}}async onThemeChanged(e){return this.listen("tauri://theme-changed",e)}},y$2=class y{constructor(e){this._preventDefault=!1;this.event=e.event,this.windowLabel=e.windowLabel,this.id=e.id;}preventDefault(){this._preventDefault=!0;}isPreventDefault(){return this._preventDefault}},s$6=class s extends h$2{constructor(e,a={}){super(e),a!=null&&a.skip||a$4({__tauriModule:"Window",message:{cmd:"createWebview",data:{options:{label:e,...a}}}}).then(async()=>this.emit("tauri://created")).catch(async n=>this.emit("tauri://error",n));}static getByLabel(e){return M$1().some(a=>a.label===e)?new s$6(e,{skip:!0}):null}},b$2;"__TAURI_METADATA__"in window?b$2=new s$6(window.__TAURI_METADATA__.__currentWindow.label,{skip:!0}):(console.warn(`Could not find "window.__TAURI_METADATA__". The "appWindow" value will reference the "main" window label.
Note that this is not an issue if running this frontend on a browser instead of a Tauri window.`),b$2=new s$6("main",{skip:!0}));function g$4(i){return i===null?null:{name:i.name,scaleFactor:i.scaleFactor,position:new o$4(i.position.x,i.position.y),size:new l$6(i.size.width,i.size.height)}}async function E$1(){return a$4({__tauriModule:"Window",message:{cmd:"manage",data:{cmd:{type:"currentMonitor"}}}}).then(g$4)}async function z$1(){return a$4({__tauriModule:"Window",message:{cmd:"manage",data:{cmd:{type:"primaryMonitor"}}}}).then(g$4)}async function T$2(){return a$4({__tauriModule:"Window",message:{cmd:"manage",data:{cmd:{type:"availableMonitors"}}}}).then(i=>i.map(g$4))}

    var s$5={};e(s$5,{isPermissionGranted:()=>o$3,requestPermission:()=>t$3,sendNotification:()=>r});async function o$3(){return window.Notification.permission!=="default"?Promise.resolve(window.Notification.permission==="granted"):a$4({__tauriModule:"Notification",message:{cmd:"isNotificationPermissionGranted"}})}async function t$3(){return window.Notification.requestPermission()}function r(i){typeof i=="string"?new window.Notification(i):new window.Notification(i.title,i);}

    function n$6(){return navigator.appVersion.includes("Win")}

    var c$6={};e(c$6,{EOL:()=>n$5,arch:()=>a$3,platform:()=>o$2,tempdir:()=>m$5,type:()=>t$2,version:()=>i$5});var n$5=n$6()?`\r
`:`
`;async function o$2(){return a$4({__tauriModule:"Os",message:{cmd:"platform"}})}async function i$5(){return a$4({__tauriModule:"Os",message:{cmd:"version"}})}async function t$2(){return a$4({__tauriModule:"Os",message:{cmd:"osType"}})}async function a$3(){return a$4({__tauriModule:"Os",message:{cmd:"arch"}})}async function m$5(){return a$4({__tauriModule:"Os",message:{cmd:"tempdir"}})}

    var x$1={};e(x$1,{BaseDirectory:()=>F$1,Dir:()=>F$1,copyFile:()=>c$5,createDir:()=>d$2,exists:()=>v$1,readBinaryFile:()=>a$2,readDir:()=>m$4,readTextFile:()=>l$5,removeDir:()=>g$3,removeFile:()=>O,renameFile:()=>_$1,writeBinaryFile:()=>f$1,writeFile:()=>u$3,writeTextFile:()=>u$3});var F$1=(n=>(n[n.Audio=1]="Audio",n[n.Cache=2]="Cache",n[n.Config=3]="Config",n[n.Data=4]="Data",n[n.LocalData=5]="LocalData",n[n.Desktop=6]="Desktop",n[n.Document=7]="Document",n[n.Download=8]="Download",n[n.Executable=9]="Executable",n[n.Font=10]="Font",n[n.Home=11]="Home",n[n.Picture=12]="Picture",n[n.Public=13]="Public",n[n.Runtime=14]="Runtime",n[n.Template=15]="Template",n[n.Video=16]="Video",n[n.Resource=17]="Resource",n[n.App=18]="App",n[n.Log=19]="Log",n[n.Temp=20]="Temp",n[n.AppConfig=21]="AppConfig",n[n.AppData=22]="AppData",n[n.AppLocalData=23]="AppLocalData",n[n.AppCache=24]="AppCache",n[n.AppLog=25]="AppLog",n))(F$1||{});async function l$5(i,t={}){return a$4({__tauriModule:"Fs",message:{cmd:"readTextFile",path:i,options:t}})}async function a$2(i,t={}){let s=await a$4({__tauriModule:"Fs",message:{cmd:"readFile",path:i,options:t}});return Uint8Array.from(s)}async function u$3(i,t,s){typeof s=="object"&&Object.freeze(s),typeof i=="object"&&Object.freeze(i);let e={path:"",contents:""},r=s;return typeof i=="string"?e.path=i:(e.path=i.path,e.contents=i.contents),typeof t=="string"?e.contents=t??"":r=t,a$4({__tauriModule:"Fs",message:{cmd:"writeFile",path:e.path,contents:Array.from(new TextEncoder().encode(e.contents)),options:r}})}async function f$1(i,t,s){typeof s=="object"&&Object.freeze(s),typeof i=="object"&&Object.freeze(i);let e={path:"",contents:[]},r=s;return typeof i=="string"?e.path=i:(e.path=i.path,e.contents=i.contents),t&&"dir"in t?r=t:typeof i=="string"&&(e.contents=t??[]),a$4({__tauriModule:"Fs",message:{cmd:"writeFile",path:e.path,contents:Array.from(e.contents instanceof ArrayBuffer?new Uint8Array(e.contents):e.contents),options:r}})}async function m$4(i,t={}){return a$4({__tauriModule:"Fs",message:{cmd:"readDir",path:i,options:t}})}async function d$2(i,t={}){return a$4({__tauriModule:"Fs",message:{cmd:"createDir",path:i,options:t}})}async function g$3(i,t={}){return a$4({__tauriModule:"Fs",message:{cmd:"removeDir",path:i,options:t}})}async function c$5(i,t,s={}){return a$4({__tauriModule:"Fs",message:{cmd:"copyFile",source:i,destination:t,options:s}})}async function O(i,t={}){return a$4({__tauriModule:"Fs",message:{cmd:"removeFile",path:i,options:t}})}async function _$1(i,t,s={}){return a$4({__tauriModule:"Fs",message:{cmd:"renameFile",oldPath:i,newPath:t,options:s}})}async function v$1(i,t={}){return a$4({__tauriModule:"Fs",message:{cmd:"exists",path:i,options:t}})}

    var q={};e(q,{BaseDirectory:()=>F$1,appCacheDir:()=>g$2,appConfigDir:()=>s$4,appDataDir:()=>c$4,appDir:()=>u$2,appLocalDataDir:()=>m$3,appLogDir:()=>n$4,audioDir:()=>d$1,basename:()=>V,cacheDir:()=>P,configDir:()=>h$1,dataDir:()=>l$4,delimiter:()=>z,desktopDir:()=>_,dirname:()=>F,documentDir:()=>p$2,downloadDir:()=>y$1,executableDir:()=>f,extname:()=>H,fontDir:()=>D,homeDir:()=>M,isAbsolute:()=>W,join:()=>E,localDataDir:()=>v,logDir:()=>w,normalize:()=>B,pictureDir:()=>b$1,publicDir:()=>A,resolve:()=>T$1,resolveResource:()=>x,resourceDir:()=>C,runtimeDir:()=>L,sep:()=>j,templateDir:()=>R,videoDir:()=>k});async function u$2(){return s$4()}async function s$4(){return a$4({__tauriModule:"Path",message:{cmd:"resolvePath",path:"",directory:21}})}async function c$4(){return a$4({__tauriModule:"Path",message:{cmd:"resolvePath",path:"",directory:22}})}async function m$3(){return a$4({__tauriModule:"Path",message:{cmd:"resolvePath",path:"",directory:23}})}async function g$2(){return a$4({__tauriModule:"Path",message:{cmd:"resolvePath",path:"",directory:24}})}async function d$1(){return a$4({__tauriModule:"Path",message:{cmd:"resolvePath",path:"",directory:1}})}async function P(){return a$4({__tauriModule:"Path",message:{cmd:"resolvePath",path:"",directory:2}})}async function h$1(){return a$4({__tauriModule:"Path",message:{cmd:"resolvePath",path:"",directory:3}})}async function l$4(){return a$4({__tauriModule:"Path",message:{cmd:"resolvePath",path:"",directory:4}})}async function _(){return a$4({__tauriModule:"Path",message:{cmd:"resolvePath",path:"",directory:6}})}async function p$2(){return a$4({__tauriModule:"Path",message:{cmd:"resolvePath",path:"",directory:7}})}async function y$1(){return a$4({__tauriModule:"Path",message:{cmd:"resolvePath",path:"",directory:8}})}async function f(){return a$4({__tauriModule:"Path",message:{cmd:"resolvePath",path:"",directory:9}})}async function D(){return a$4({__tauriModule:"Path",message:{cmd:"resolvePath",path:"",directory:10}})}async function M(){return a$4({__tauriModule:"Path",message:{cmd:"resolvePath",path:"",directory:11}})}async function v(){return a$4({__tauriModule:"Path",message:{cmd:"resolvePath",path:"",directory:5}})}async function b$1(){return a$4({__tauriModule:"Path",message:{cmd:"resolvePath",path:"",directory:12}})}async function A(){return a$4({__tauriModule:"Path",message:{cmd:"resolvePath",path:"",directory:13}})}async function C(){return a$4({__tauriModule:"Path",message:{cmd:"resolvePath",path:"",directory:17}})}async function x(t){return a$4({__tauriModule:"Path",message:{cmd:"resolvePath",path:t,directory:17}})}async function L(){return a$4({__tauriModule:"Path",message:{cmd:"resolvePath",path:"",directory:14}})}async function R(){return a$4({__tauriModule:"Path",message:{cmd:"resolvePath",path:"",directory:15}})}async function k(){return a$4({__tauriModule:"Path",message:{cmd:"resolvePath",path:"",directory:16}})}async function w(){return n$4()}async function n$4(){return a$4({__tauriModule:"Path",message:{cmd:"resolvePath",path:"",directory:25}})}var j=n$6()?"\\":"/",z=n$6()?";":":";async function T$1(...t){return a$4({__tauriModule:"Path",message:{cmd:"resolve",paths:t}})}async function B(t){return a$4({__tauriModule:"Path",message:{cmd:"normalize",path:t}})}async function E(...t){return a$4({__tauriModule:"Path",message:{cmd:"join",paths:t}})}async function F(t){return a$4({__tauriModule:"Path",message:{cmd:"dirname",path:t}})}async function H(t){return a$4({__tauriModule:"Path",message:{cmd:"extname",path:t}})}async function V(t,a){return a$4({__tauriModule:"Path",message:{cmd:"basename",path:t,ext:a}})}async function W(t){return a$4({__tauriModule:"Path",message:{cmd:"isAbsolute",path:t}})}

    var s$3={};e(s$3,{exit:()=>i$4,relaunch:()=>n$3});async function i$4(r=0){return a$4({__tauriModule:"Process",message:{cmd:"exit",exitCode:r}})}async function n$3(){return a$4({__tauriModule:"Process",message:{cmd:"relaunch"}})}

    var m$2={};e(m$2,{Child:()=>h,Command:()=>l$3,EventEmitter:()=>i$3,open:()=>g$1});async function p$1(o,e,t=[],r){return typeof t=="object"&&Object.freeze(t),a$4({__tauriModule:"Shell",message:{cmd:"execute",program:e,args:t,options:r,onEventFn:s$8(o)}})}var i$3=class i{constructor(){this.eventListeners=Object.create(null);}addListener(e,t){return this.on(e,t)}removeListener(e,t){return this.off(e,t)}on(e,t){return e in this.eventListeners?this.eventListeners[e].push(t):this.eventListeners[e]=[t],this}once(e,t){let r=(...s)=>{this.removeListener(e,r),t(...s);};return this.addListener(e,r)}off(e,t){return e in this.eventListeners&&(this.eventListeners[e]=this.eventListeners[e].filter(r=>r!==t)),this}removeAllListeners(e){return e?delete this.eventListeners[e]:this.eventListeners=Object.create(null),this}emit(e,...t){if(e in this.eventListeners){let r=this.eventListeners[e];for(let s of r)s(...t);return !0}return !1}listenerCount(e){return e in this.eventListeners?this.eventListeners[e].length:0}prependListener(e,t){return e in this.eventListeners?this.eventListeners[e].unshift(t):this.eventListeners[e]=[t],this}prependOnceListener(e,t){let r=(...s)=>{this.removeListener(e,r),t(...s);};return this.prependListener(e,r)}},h=class{constructor(e){this.pid=e;}async write(e){return a$4({__tauriModule:"Shell",message:{cmd:"stdinWrite",pid:this.pid,buffer:typeof e=="string"?e:Array.from(e)}})}async kill(){return a$4({__tauriModule:"Shell",message:{cmd:"killChild",pid:this.pid}})}},l$3=class l extends i$3{constructor(t,r=[],s){super();this.stdout=new i$3;this.stderr=new i$3;this.program=t,this.args=typeof r=="string"?[r]:r,this.options=s??{};}static sidecar(t,r=[],s){let a=new l$3(t,r,s);return a.options.sidecar=!0,a}async spawn(){return p$1(t=>{switch(t.event){case"Error":this.emit("error",t.payload);break;case"Terminated":this.emit("close",t.payload);break;case"Stdout":this.stdout.emit("data",t.payload);break;case"Stderr":this.stderr.emit("data",t.payload);break}},this.program,this.args,this.options).then(t=>new h(t))}async execute(){return new Promise((t,r)=>{this.on("error",r);let s=[],a=[];this.stdout.on("data",n=>{s.push(n);}),this.stderr.on("data",n=>{a.push(n);}),this.on("close",n=>{t({code:n.code,signal:n.signal,stdout:s.join(`
`),stderr:a.join(`
`)});}),this.spawn().catch(r);})}};async function g$1(o,e){return a$4({__tauriModule:"Shell",message:{cmd:"open",path:o,with:e}})}

    var u$1={};e(u$1,{getName:()=>n$2,getTauriVersion:()=>s$2,getVersion:()=>i$2,hide:()=>t$1,show:()=>o$1});async function i$2(){return a$4({__tauriModule:"App",message:{cmd:"getAppVersion"}})}async function n$2(){return a$4({__tauriModule:"App",message:{cmd:"getAppName"}})}async function s$2(){return a$4({__tauriModule:"App",message:{cmd:"getTauriVersion"}})}async function o$1(){return a$4({__tauriModule:"App",message:{cmd:"show"}})}async function t$1(){return a$4({__tauriModule:"App",message:{cmd:"hide"}})}

    var c$3={};e(c$3,{getMatches:()=>t});async function t(){return a$4({__tauriModule:"Cli",message:{cmd:"cliMatches"}})}

    var n$1={};e(n$1,{readText:()=>i$1,writeText:()=>a$1});async function a$1(r){return a$4({__tauriModule:"Clipboard",message:{cmd:"writeText",data:r}})}async function i$1(){return a$4({__tauriModule:"Clipboard",message:{cmd:"readText",data:null}})}

    var m$1={};e(m$1,{ask:()=>l$2,confirm:()=>c$2,message:()=>s$1,open:()=>g,save:()=>o});async function g(i={}){return typeof i=="object"&&Object.freeze(i),a$4({__tauriModule:"Dialog",message:{cmd:"openDialog",options:i}})}async function o(i={}){return typeof i=="object"&&Object.freeze(i),a$4({__tauriModule:"Dialog",message:{cmd:"saveDialog",options:i}})}async function s$1(i,t){var n;let e=typeof t=="string"?{title:t}:t;return a$4({__tauriModule:"Dialog",message:{cmd:"messageDialog",message:i.toString(),title:(n=e==null?void 0:e.title)==null?void 0:n.toString(),type:e==null?void 0:e.type}})}async function l$2(i,t){var n;let e=typeof t=="string"?{title:t}:t;return a$4({__tauriModule:"Dialog",message:{cmd:"askDialog",message:i.toString(),title:(n=e==null?void 0:e.title)==null?void 0:n.toString(),type:e==null?void 0:e.type}})}async function c$2(i,t){var n;let e=typeof t=="string"?{title:t}:t;return a$4({__tauriModule:"Dialog",message:{cmd:"confirmDialog",message:i.toString(),title:(n=e==null?void 0:e.title)==null?void 0:n.toString(),type:e==null?void 0:e.type}})}

    var c$1={};e(c$1,{isRegistered:()=>u,register:()=>s,registerAll:()=>n,unregister:()=>a,unregisterAll:()=>l$1});async function s(r,t){return a$4({__tauriModule:"GlobalShortcut",message:{cmd:"register",shortcut:r,handler:s$8(t)}})}async function n(r,t){return a$4({__tauriModule:"GlobalShortcut",message:{cmd:"registerAll",shortcuts:r,handler:s$8(t)}})}async function u(r){return a$4({__tauriModule:"GlobalShortcut",message:{cmd:"isRegistered",shortcut:r}})}async function a(r){return a$4({__tauriModule:"GlobalShortcut",message:{cmd:"unregister",shortcut:r}})}async function l$1(){return a$4({__tauriModule:"GlobalShortcut",message:{cmd:"unregisterAll"}})}

    var T={};e(T,{Body:()=>i,Client:()=>l,Response:()=>m,ResponseType:()=>p,fetch:()=>y,getClient:()=>d});var p=(s=>(s[s.JSON=1]="JSON",s[s.Text=2]="Text",s[s.Binary=3]="Binary",s))(p||{}),i=class{constructor(e,r){this.type=e,this.payload=r;}static form(e){let r={},s=(n,t)=>{if(t!==null){let a;typeof t=="string"?a=t:t instanceof Uint8Array||Array.isArray(t)?a=Array.from(t):t instanceof File?a={file:t.name,mime:t.type,fileName:t.name}:typeof t.file=="string"?a={file:t.file,mime:t.mime,fileName:t.fileName}:a={file:Array.from(t.file),mime:t.mime,fileName:t.fileName},r[String(n)]=a;}};if(e instanceof FormData)for(let[n,t]of e)s(n,t);else for(let[n,t]of Object.entries(e))s(n,t);return new i("Form",r)}static json(e){return new i("Json",e)}static text(e){return new i("Text",e)}static bytes(e){return new i("Bytes",Array.from(e instanceof ArrayBuffer?new Uint8Array(e):e))}},m=class{constructor(e){this.url=e.url,this.status=e.status,this.ok=this.status>=200&&this.status<300,this.headers=e.headers,this.rawHeaders=e.rawHeaders,this.data=e.data;}},l=class{constructor(e){this.id=e;}async drop(){return a$4({__tauriModule:"Http",message:{cmd:"dropClient",client:this.id}})}async request(e){let r=!e.responseType||e.responseType===1;return r&&(e.responseType=2),a$4({__tauriModule:"Http",message:{cmd:"httpRequest",client:this.id,options:e}}).then(s=>{let n=new m(s);if(r){try{n.data=JSON.parse(n.data);}catch(t){if(n.ok&&n.data==="")n.data={};else if(n.ok)throw Error(`Failed to parse response \`${n.data}\` as JSON: ${t};
              try setting the \`responseType\` option to \`ResponseType.Text\` or \`ResponseType.Binary\` if the API does not return a JSON response.`)}return n}return n})}async get(e,r){return this.request({method:"GET",url:e,...r})}async post(e,r,s){return this.request({method:"POST",url:e,body:r,...s})}async put(e,r,s){return this.request({method:"PUT",url:e,body:r,...s})}async patch(e,r){return this.request({method:"PATCH",url:e,...r})}async delete(e,r){return this.request({method:"DELETE",url:e,...r})}};async function d(o){return a$4({__tauriModule:"Http",message:{cmd:"createClient",options:o}}).then(e=>new l(e))}var c=null;async function y(o,e){return c===null&&(c=await d()),c.request({url:o,method:(e==null?void 0:e.method)??"GET",...e})}

    var b=c$a;

    /**
     * Small wrapper on top of tauri api invoke
     *
     * best-practice: Light and narrow external api abstraction.
     */
    async function ipc_invoke(method, params) {
        const response = await b(method, { params });
        if (response.error != null) {
            console.log('ERROR - ipc_invoke - ipc_invoke error', response);
            throw new Error(response.error);
        }
        else {
            return deepFreeze(response.result);
        }
    }

    var _BaseFmc_cmd_suffix;
    /**
     * Base Frontend Model Controller class with basic CRUD except `list` which will be per subclass for now.
     *
     * - M - For the Enity model type (e.g., Project)
     * - C - For the Create data type (e.g., ProjectForCreate)
     * - U - For the update data type (e.g., ProjectForUpdate)
     */
    class BaseFmc {
        get cmd_suffix() { return __classPrivateFieldGet(this, _BaseFmc_cmd_suffix, "f"); }
        constructor(cmd_suffix) {
            _BaseFmc_cmd_suffix.set(this, void 0);
            __classPrivateFieldSet(this, _BaseFmc_cmd_suffix, cmd_suffix, "f");
        }
        async get(id) {
            return ipc_invoke(`get_${__classPrivateFieldGet(this, _BaseFmc_cmd_suffix, "f")}`, { id }).then(res => res.data);
        }
        async create(data) {
            return ipc_invoke(`create_${__classPrivateFieldGet(this, _BaseFmc_cmd_suffix, "f")}`, { data }).then(res => {
                return ensure_ModelMutateResultData(res.data);
            });
        }
        async update(id, data) {
            return ipc_invoke(`update_${__classPrivateFieldGet(this, _BaseFmc_cmd_suffix, "f")}`, { id, data }).then(res => {
                return ensure_ModelMutateResultData(res.data);
            });
        }
        async delete(id) {
            return ipc_invoke(`delete_${__classPrivateFieldGet(this, _BaseFmc_cmd_suffix, "f")}`, { id }).then(res => res.data);
        }
    }
    _BaseFmc_cmd_suffix = new WeakMap();
    // #region    --- ProjectFmc
    class ProjectFmc extends BaseFmc {
        constructor() {
            super("project");
        }
        async list() {
            // Note: for now, we just add a 's' for list, might might get rid of plurals
            return ipc_invoke(`list_${this.cmd_suffix}s`, {}).then(res => res.data);
        }
    }
    const projectFmc = new ProjectFmc();
    // #endregion --- ProjectFmc
    // #region    --- TaskBmc
    class TaskFmc extends BaseFmc {
        constructor() {
            super("task");
        }
        async list(filter) {
            // prune the empty string so that the UI does not have to do too much. 
            filter = pruneEmpty(filter);
            // Note: for now, we just add a 's' for list, might might get rid of plurals
            return ipc_invoke(`list_${this.cmd_suffix}s`, { filter }).then(res => res.data);
        }
    }
    const taskFmc = new TaskFmc();
    // #endregion --- TaskBmc

    var _Router_current_route;
    const route_hub = hub("Route");
    class Router {
        constructor() {
            _Router_current_route.set(this, {});
        }
        update_state(state) {
            // Note: DeepClone when Route state cannot be assumed to be flat anymore.
            Object.assign(__classPrivateFieldGet(this, _Router_current_route, "f"), state);
            route_hub.pub("change", null);
        }
        get_current() {
            // clone for safety (shallow enough as route is designed to be flat)
            return { ...__classPrivateFieldGet(this, _Router_current_route, "f") };
        }
    }
    _Router_current_route = new WeakMap();
    const router = new Router();

    //! Main Application View which will initialize the application and display the appropriate 
    //!
    //! Notes:
    //!   - Will listen to Route.change event, and update the main view
    //!   - The Nav View `nav-v` will manage it's routing update.
    //!
    //! TODO: Needs to implement the menu click (min-nav action)
    //!
    var _AppView_mainEl;
    // dom-native JS Tagged templates to create a DocumentFragment (parse once)
    const HTML$2 = html `
	<header>
	<d-ico class="menu action" name="ico-menu"></d-ico>
	<h1>Rust Task</h1>
	</header>
	<nav-v></nav-v>
	<main></main>
`;
    let AppView = class AppView extends BaseHTMLElement {
        constructor() {
            super(...arguments);
            // #region    --- Key Els
            _AppView_mainEl.set(this, void 0);
        }
        // #endregion --- Key Els
        // #region    --- App Events
        async onRouteChange() {
            const { project_id } = router.get_current();
            if (project_id != null) {
                const project = await projectFmc.get(project_id);
                const projectEl = elem('project-v', { $: { project } });
                __classPrivateFieldGet(this, _AppView_mainEl, "f").replaceChildren(projectEl);
            }
            else {
                __classPrivateFieldGet(this, _AppView_mainEl, "f").textContent = "Welcome select project";
            }
        }
        // #endregion --- App Events
        // #region    --- UI Events
        onMenuClick(evt) {
            this.classList.toggle("min-nav");
        }
        // #endregion --- UI Events
        init() {
            var _a, _b;
            // clone the HTML documentFragment and get the key elements (to be used later)
            let content = document.importNode(HTML$2, true);
            __classPrivateFieldSet(this, _AppView_mainEl, getFirst(content, "main"), "f");
            // beautify the header h1
            const h1 = first(content, 'header > h1');
            if (h1) {
                if (h1.firstElementChild == null) {
                    const text = (_b = (_a = h1.textContent) === null || _a === void 0 ? void 0 : _a.split(/[-_ ](.+)/)) !== null && _b !== void 0 ? _b : ["NO", "NAME"];
                    h1.replaceChildren(html `<span>${text[0]}</span><span class="prime">${text[1]}</span>`);
                }
            }
            // replace the children
            this.replaceChildren(content);
        }
    };
    _AppView_mainEl = new WeakMap();
    __decorate$1([
        onHub("Route", "change") // @onHub(hubName, topic, label?)
    ], AppView.prototype, "onRouteChange", null);
    __decorate$1([
        onEvent("pointerup", "header > c-ico.menu") // @onEvent(eventType, elementSelectorFromThis)
    ], AppView.prototype, "onMenuClick", null);
    AppView = __decorate$1([
        customElement('app-v') // same as customElements.define('app-v', AppView)
    ], AppView);

    let MenuComponent = class MenuComponent extends BaseHTMLElement {
        // #region    --- Data
        // This data is disposable, no need to keep, and the key is stored as children attribute.
        set options(v) { this.update(v); }
        // #endregion --- Data
        // #region    --- UI Events
        onLiClick(evt) {
            const key = evt.selectTarget.getAttribute("data-key");
            trigger(this, "SELECT", { detail: key });
            this.remove();
        }
        onDocClick(evt) {
            if (!this.contains(evt.target)) {
                this.remove();
            }
        }
        // #endregion --- UI Events
        // Note: For this component, no need to check if same data, just refresh.
        //       And the key is stored in the data-key, so, nothing else to store. 
        //       Less is simpler.
        //       The frozen is not really needed here as we do not store it.
        //       However, just for consistency.
        update(options) {
            // and replace the content
            const els = Object.entries(options).map(([k, v]) => {
                const el = elem('li', { "data-key": k });
                if (typeof v == "string") {
                    el.textContent = v;
                }
                else {
                    el.appendChild(v);
                }
                return el;
            });
            this.replaceChildren(...els);
        }
    };
    __decorate$1([
        onEvent('pointerup', 'li')
    ], MenuComponent.prototype, "onLiClick", null);
    __decorate$1([
        onDoc('pointerup', { nextFrame: true })
    ], MenuComponent.prototype, "onDocClick", null);
    MenuComponent = __decorate$1([
        customElement('menu-c')
    ], MenuComponent);

    var _NavView_headerEl, _NavView_contentEl, _ProjectNewInput_d_input;
    const HTML$1 = html `
<header>
	<label>Projects</label>
	<d-ico class="action show-add-project" name="ico-add"></d-ico>
</header>
<section>
</section>
`;
    let NavView = class NavView extends BaseHTMLElement {
        constructor() {
            super(...arguments);
            // #region    --- Key Els
            _NavView_headerEl.set(this, void 0);
            _NavView_contentEl.set(this, void 0);
        }
        // #endregion --- Key Els
        // #region    --- App Events
        async onProjectCreate(data) {
            this.refreshContent();
            router.update_state({
                project_id: data.id
            });
        }
        onRouteChange() {
            this.updateContentSel();
        }
        // #endregion --- App Events
        // #region    --- UI Events
        onShowAddProject() {
            let inputEl = first(__classPrivateFieldGet(this, _NavView_headerEl, "f"), "project-new-ipt");
            // if already showing, we toggle it off (cancel)
            if (inputEl != null) {
                inputEl.remove();
                return;
            }
            // otherwise, we add the d-input
            else {
                const inputEl = __classPrivateFieldGet(this, _NavView_headerEl, "f").appendChild(elem("project-new-ipt"));
                inputEl.focus();
                on(inputEl, "CHANGE", (evt) => {
                    const val = evt.detail.value;
                    if (val.length > 0) {
                        projectFmc.create({ name: val });
                        inputEl.clear(); // this will triggern a CHANGE with value ""
                    }
                    else {
                        inputEl.remove();
                    }
                });
            }
        }
        selNav(evt) {
            const project_id = evt.selectTarget.getAttribute("data-id");
            router.update_state({ project_id });
        }
        // #endregion --- UI Events
        init() {
            var _a, _b;
            const content = document.importNode(HTML$1, true);
            _a = this, _b = this, [({ set value(_c) { __classPrivateFieldSet(_a, _NavView_headerEl, _c, "f"); } }).value, ({ set value(_c) { __classPrivateFieldSet(_b, _NavView_contentEl, _c, "f"); } }).value] = scanChild(content, 'header', 'section');
            this.replaceChildren(content);
            this.refreshContent(true);
        }
        async refreshContent(first_refresh) {
            const projects = await projectFmc.list();
            // Create the content DocumentFragment from the projects and replace children
            const content = frag(projects, (prj) => elem('a', { "data-id": prj.id, $: { textContent: prj.name } }));
            __classPrivateFieldGet(this, _NavView_contentEl, "f").replaceChildren(content);
            // Update selction
            this.updateContentSel();
            // If first refresh, select first project (update router)
            if (first_refresh && projects.length > 0) {
                router.update_state({ project_id: projects[0].id });
            }
        }
        updateContentSel() {
            let { project_id } = router.get_current();
            all(this, `section > a.sel`).forEach(el => el.classList.remove("sel"));
            if (project_id != null) {
                const el = first(`section > a[data-id="${project_id}"]`);
                el === null || el === void 0 ? void 0 : el.classList.add("sel");
            }
        }
    };
    _NavView_headerEl = new WeakMap();
    _NavView_contentEl = new WeakMap();
    __decorate$1([
        onHub("Model", "project", "create")
    ], NavView.prototype, "onProjectCreate", null);
    __decorate$1([
        onHub("Route", "change")
    ], NavView.prototype, "onRouteChange", null);
    __decorate$1([
        onEvent("pointerdown", "header > .show-add-project")
    ], NavView.prototype, "onShowAddProject", null);
    __decorate$1([
        onEvent("pointerdown", "section > a")
    ], NavView.prototype, "selNav", null);
    NavView = __decorate$1([
        customElement('nav-v')
    ], NavView);
    let ProjectNewInput = class ProjectNewInput extends BaseHTMLElement {
        constructor() {
            super(...arguments);
            // #region    --- Key Els
            _ProjectNewInput_d_input.set(this, void 0);
        }
        // #endregion --- Key Els
        // #region    --- UI Events
        // Note: here we need keydown and preventDefault if we want to avoid the "ding" sound.
        onExecKey(evt) {
            if (evt.key == "Escape") { // we cancel
                this.remove();
                evt.preventDefault();
            }
        }
        // #endregion --- UI Events
        init() {
            __classPrivateFieldSet(this, _ProjectNewInput_d_input, elem("d-input", { placeholder: "Project name (press Enter)" }), "f");
            this.replaceChildren(__classPrivateFieldGet(this, _ProjectNewInput_d_input, "f"));
        }
        focus() {
            // Note: This is a little trick to make sure the focus command does not get loss
            requestAnimationFrame(() => {
                __classPrivateFieldGet(this, _ProjectNewInput_d_input, "f").focus();
            });
        }
        clear() {
            __classPrivateFieldGet(this, _ProjectNewInput_d_input, "f").value = "";
        }
    };
    _ProjectNewInput_d_input = new WeakMap();
    __decorate$1([
        onEvent("keydown")
    ], ProjectNewInput.prototype, "onExecKey", null);
    ProjectNewInput = __decorate$1([
        customElement('project-new-ipt')
    ], ProjectNewInput);

    var _ProjectView_project, _ProjectView_titleEl, _ProjectView_contentEl, _ProjectView_newTaskDInputEl, _ProjectView_searchTaskDInputEl;
    const HTML = html `
<header>
<h1></h1>
<d-input class="new-task" placeholder="Enter new task (press enter)"></d-input>
</header>
<d-input class="search-task" placeholder="Search your task"></d-input>
<section></section>
`;
    let ProjectView = class ProjectView extends BaseHTMLElement {
        constructor() {
            super(...arguments);
            // #region    --- Data
            _ProjectView_project.set(this, void 0);
            // #endregion --- Data
            // #region    --- Key Els
            _ProjectView_titleEl.set(this, void 0);
            _ProjectView_contentEl.set(this, void 0);
            _ProjectView_newTaskDInputEl.set(this, void 0);
            _ProjectView_searchTaskDInputEl.set(this, void 0);
        }
        set project(p) { __classPrivateFieldSet(this, _ProjectView_project, p, "f"); this.update(); }
        // #endregion --- Key Els
        // #region    --- UI Events
        onNewTaskInput(evt) {
            let title = evt.selectTarget.value.trim();
            if (title.length > 0) {
                // Create the task
                const project_id = __classPrivateFieldGet(this, _ProjectView_project, "f").id;
                taskFmc.create({ project_id, title });
                // Clear the input
                // Note: Here we could also do an await on create, before clearing the input. 
                //       Or listening the create event back on task (which is debetable).
                __classPrivateFieldGet(this, _ProjectView_newTaskDInputEl, "f").value = '';
            }
        }
        onSearchChange(evt) {
            let search = evt.selectTarget.value.trim();
            if (search.length > 0) {
                this.update({ title: { $contains: search } });
            }
            else {
                this.update();
            }
        }
        onTasksIsEmpty() {
            __classPrivateFieldGet(this, _ProjectView_newTaskDInputEl, "f").focus();
        }
        // #endregion --- UI Events
        init() {
            var _a, _b, _c, _d;
            const content = document.importNode(HTML, true);
            _a = this, _b = this, _c = this, _d = this, [({ set value(_e) { __classPrivateFieldSet(_a, _ProjectView_titleEl, _e, "f"); } }).value, ({ set value(_e) { __classPrivateFieldSet(_b, _ProjectView_contentEl, _e, "f"); } }).value, ({ set value(_e) { __classPrivateFieldSet(_c, _ProjectView_newTaskDInputEl, _e, "f"); } }).value, ({ set value(_e) { __classPrivateFieldSet(_d, _ProjectView_searchTaskDInputEl, _e, "f"); } }).value] =
                getFirst(content, "h1", "section", "d-input.new-task", "d-input.search-task");
            this.replaceChildren(content);
            this.update();
        }
        async update(filter) {
            if (__classPrivateFieldGet(this, _ProjectView_contentEl, "f") && __classPrivateFieldGet(this, _ProjectView_titleEl, "f")) {
                __classPrivateFieldGet(this, _ProjectView_titleEl, "f").textContent = __classPrivateFieldGet(this, _ProjectView_project, "f").name;
                const taskDt = elem('tasks-dt', { $: { project_id: __classPrivateFieldGet(this, _ProjectView_project, "f").id, filter } });
                __classPrivateFieldGet(this, _ProjectView_contentEl, "f").replaceChildren(taskDt);
            }
        }
    };
    _ProjectView_project = new WeakMap();
    _ProjectView_titleEl = new WeakMap();
    _ProjectView_contentEl = new WeakMap();
    _ProjectView_newTaskDInputEl = new WeakMap();
    _ProjectView_searchTaskDInputEl = new WeakMap();
    __decorate$1([
        onEvent("CHANGE", "d-input.new-task")
    ], ProjectView.prototype, "onNewTaskInput", null);
    __decorate$1([
        onEvent("CHANGE", "d-input.search-task")
    ], ProjectView.prototype, "onSearchChange", null);
    __decorate$1([
        onEvent("EMPTY", "tasks-dt")
    ], ProjectView.prototype, "onTasksIsEmpty", null);
    ProjectView = __decorate$1([
        customElement('project-v')
    ], ProjectView);

    /**
     * Narrow utility to make a string css class "compatible".
     * TODO: Need to make it more exhaustive.
     */
    function classable(str) {
        return str.replace(":", "_");
    }

    var _TasksDataTable_project_id, _TasksDataTable_filter, _TaskRow_task, _TaskRow_checkEl, _TaskRow_titleEl, _TaskRow_infoEl;
    const TASK_HEADER = html `
	<div class="th">Title </div>
	<div class="th">Info</div>
	<div class="th done">Done</div>
	<div class="th more">&nbsp;</div>
`;
    const TASK_ROW_HTML = html `
	<span class="title"></span>
	<span class="info"></span>
	<d-check class="done"></d-check>
	<d-ico class="show-more" name="ico-more"></d-ico>
`;
    let TasksDataTable = class TasksDataTable extends BaseHTMLElement {
        constructor() {
            super(...arguments);
            // #region    --- Data
            _TasksDataTable_project_id.set(this, void 0);
            _TasksDataTable_filter.set(this, void 0);
        }
        set project_id(v) { __classPrivateFieldSet(this, _TasksDataTable_project_id, v, "f"); this.update(); }
        set filter(f) { __classPrivateFieldSet(this, _TasksDataTable_filter, f, "f"); this.update(); }
        // #endregion --- Data
        // #region    --- App Event
        // Create will refresh the full datagrid, in case of sort by name and such
        onTaskCreate() {
            this.update();
        }
        // Delete can be more selective in this case, will delete the row
        onTaskDelete(data) {
            all(this, `task-row.${classable(data.id)}`).forEach(taskRowEl => {
                // Note: This will add the class in the taskRow, but the animations are on the cells
                //       as the task-row as the display: contents in the css 
                //       (to be transparent to the grid layout, hence, can't style it)
                taskRowEl.classList.add('anim-delete');
                // Note: Trick to start the dom deletion before the animation terminate to make it snapier 
                setTimeout(() => {
                    taskRowEl.remove();
                }, 100);
                // Note: This is sementically correct way to delete it, on first transition end. 
                // taskRowEl.addEventListener('transitionend', (evt) => {
                //   // Note: Here we will get many events back (one per animated element and property)
                //   //       So, just delete on first.
                //   if (taskRowEl.isConnected) {
                //     taskRowEl.remove()
                //   }
                // });
            });
        }
        async onTaskUpdate(data) {
            const newTask = await taskFmc.get(data.id);
            all(this, `task-row.${classable(data.id)}`).forEach((taskEl) => taskEl.task = newTask);
        }
        // #endregion --- App Event
        // #region    --- UI Events
        onTaskShowMore(evt) {
            const MENU_CLASS = 'task-row-more-menu';
            // if already showing (will auto remove, but we do not want to popup it again)
            if (first(`body > menu-c.${MENU_CLASS}`))
                return;
            const showMoreEl = evt.selectTarget;
            const task = showMoreEl.closest('task-row').task;
            const options = {
                'toggle': (task.done) ? "Mark Undone" : "Mark Done",
                'delete': elem("label", { class: "delete", $: { textContent: "Delete" } }),
            };
            // Show the meunu
            const menuEl = elem("menu-c", { "class": MENU_CLASS, $: { options } });
            document.body.appendChild(menuEl);
            on(menuEl, "SELECT", (evt) => {
                if (evt.detail == 'delete') {
                    taskFmc.delete(task.id);
                }
                else if (evt.detail == 'toggle') {
                    taskFmc.update(task.id, { done: !task.done });
                }
            });
            position$1(menuEl, showMoreEl, { refPos: "BR", pos: "BL", gap: 4 });
        }
        onTaskCheckClick(evt) {
            let taskEl = evt.selectTarget.closest("task-row");
            let task_id = taskEl.task.id;
            let newDone = evt.detail.value;
            // Make sure to avoid infine loop 
            // (will get this event when changed by other mean as well)
            if (newDone !== taskEl.task.done) {
                taskFmc.update(task_id, { done: evt.detail.value });
            }
        }
        // #endregion --- UI Events
        postDisplay() {
            this.update();
        }
        async update() {
            if (this.initialized) {
                const filter = {
                    project_id: __classPrivateFieldGet(this, _TasksDataTable_project_id, "f"),
                    ...__classPrivateFieldGet(this, _TasksDataTable_filter, "f")
                };
                const tasks = await taskFmc.list(filter);
                const content = frag(tasks, task => elem('task-row', { $: { task } }));
                content.prepend(document.importNode(TASK_HEADER, true));
                this.replaceChildren(content);
                if (tasks.length == 0) {
                    trigger(this, "EMPTY");
                }
            }
        }
    };
    _TasksDataTable_project_id = new WeakMap();
    _TasksDataTable_filter = new WeakMap();
    __decorate$1([
        onHub("Model", "task", "create")
    ], TasksDataTable.prototype, "onTaskCreate", null);
    __decorate$1([
        onHub("Model", "task", "delete")
    ], TasksDataTable.prototype, "onTaskDelete", null);
    __decorate$1([
        onHub("Model", "task", "update")
    ], TasksDataTable.prototype, "onTaskUpdate", null);
    __decorate$1([
        onEvent("pointerup", "task-row .show-more")
    ], TasksDataTable.prototype, "onTaskShowMore", null);
    __decorate$1([
        onEvent("CHANGE", "task-row d-check")
    ], TasksDataTable.prototype, "onTaskCheckClick", null);
    TasksDataTable = __decorate$1([
        customElement('tasks-dt')
    ], TasksDataTable);
    // #region    --- task-row
    let TaskRow = class TaskRow extends BaseHTMLElement {
        constructor() {
            super(...arguments);
            // #region    --- Data
            _TaskRow_task.set(this, void 0);
            // #endregion --- Data
            // #region    --- Key Els
            _TaskRow_checkEl.set(this, void 0);
            _TaskRow_titleEl.set(this, void 0);
            _TaskRow_infoEl.set(this, void 0);
        }
        set task(newTask) {
            const oldTask = __classPrivateFieldGet(this, _TaskRow_task, "f");
            if (oldTask !== newTask) {
                __classPrivateFieldSet(this, _TaskRow_task, newTask, "f");
                this.update(newTask, oldTask);
            }
        }
        get task() { return __classPrivateFieldGet(this, _TaskRow_task, "f"); }
        // #endregion --- Key Els
        init() {
            var _a, _b, _c;
            super.init();
            let content = document.importNode(TASK_ROW_HTML, true);
            // Note: dom-native scanChild is a strict one fast pass child scanner. 
            //       Use all/first if needs to be more flexible. 
            _a = this, _b = this, _c = this, [({ set value(_d) { __classPrivateFieldSet(_a, _TaskRow_titleEl, _d, "f"); } }).value, ({ set value(_d) { __classPrivateFieldSet(_b, _TaskRow_infoEl, _d, "f"); } }).value, ({ set value(_d) { __classPrivateFieldSet(_c, _TaskRow_checkEl, _d, "f"); } }).value] = scanChild(content, 'span', 'span', 'd-check');
            // FIXME: Check that order does not matter here.
            this.replaceChildren(content);
            this.update(__classPrivateFieldGet(this, _TaskRow_task, "f"));
        }
        update(newTask, oldTask) {
            if (oldTask) {
                this.classList.remove(`${classable(oldTask.id)}`);
            }
            // if ready to be injected, we do the job
            if (newTask && __classPrivateFieldGet(this, _TaskRow_titleEl, "f") != null) {
                this.classList.add(`${classable(newTask.id)}`);
                __classPrivateFieldGet(this, _TaskRow_checkEl, "f").checked = newTask.done;
                __classPrivateFieldGet(this, _TaskRow_titleEl, "f").textContent = newTask.title;
                let info = newTask.ctime;
                info = info.substring(info.length - 5);
                __classPrivateFieldGet(this, _TaskRow_infoEl, "f").textContent = `(ctime: ${info})`;
            }
        }
    };
    _TaskRow_task = new WeakMap();
    _TaskRow_checkEl = new WeakMap();
    _TaskRow_titleEl = new WeakMap();
    _TaskRow_infoEl = new WeakMap();
    TaskRow = __decorate$1([
        customElement('task-row')
    ], TaskRow);
    // #endregion --- task-row

    // load the default icons from @dom-native/ui
    loadDefaultIcons();
    // --- Initialize some assets on DOMContentLoaded
    document.addEventListener("DOMContentLoaded", async function (event) {
        // Append the app custom icons 
        // (similar to what loadDefaultIcons does for @dom-native/ui icons)
        // (this allows to use the <use xlink:href="#symbol_id" ...> and update fill from css)
        const svgEl = html(SYMBOLS).firstElementChild;
        svgEl.setAttribute('style', 'display: none'); // in case dom engine move it to body
        document.head.appendChild(svgEl);
    });

})();
//# sourceMappingURL=app-bundle.js.map

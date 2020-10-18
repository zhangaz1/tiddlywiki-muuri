/*\
title: $:/plugins/BTC/Muuri/modules/storyviews/muuri.js
type: application/javascript
module-type: storyview

Views the story as a muuri grid

\*/
(function() {

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

var easing = "cubic-bezier(0.215, 0.61, 0.355, 1)";

var COLUMN_CONFIG = "$:/state/config/muuri/storyview/columns",
		SEAMLESS_CONFIG = "$:/config/muuri/storyview/fill-gaps",
		ALIGNRIGHT_CONFIG = "$:/state/config/muuri/storyview/align-right",
		ALIGNBOTTOM_CONFIG = "$:/state/config/muuri/storyview/align-bottom",
		DRAGSORTACTION_CONFIG = "$:/config/muuri/storyview/dragsort-action",
		DRAGSORTTHRESHOLD_CONFIG ="$:/config/muuri/storyview/dragsort-threshold",
		SELECTTEXT_CONFIG = "$:/state/config/muuri/storyview/select-text";

if(typeof window !== "undefined") {
	var testElement = document.body;
	if(typeof testElement.animate !== "function" && typeof testElement.animate !== "FUNCTION") {
		require("$:/plugins/BTC/Muuri/library/web-animations-polyfill.js");
	}
	if(!window.Muuri) {
		window.Muuri = require("$:/plugins/BTC/Muuri/library/muuri.min.js");
	}
}

var MuuriStoryView = function(listWidget) {
	var self = this;
	this.listWidget = listWidget;
	this.itemTitlesArray = [];

	this.getMuuriAttributes();
	this.createMuuriGrid();

	this.muuri.on("dragReleaseEnd",function(item) {
		self.onDragReleaseEnd(item);
	})
	.on("add", function(items) {
	})
	.on("remove", function(items) {
	})
	.on("dragEnd", function(item, event) {
		self.restoreIframeEvents();
	})
	.on("dragStart", function(item, event) {
	})
	.on("layoutStart", function() {
	})
	.on("layoutEnd", function() {
		self.updateZIndexList();
	})
	.on("destroy", function() {
		self.removeAllListeners();
	})
	.on("dragInit",function(item, event) {
		//add pointer-events: none; to all iframes
		self.inheritIframeEvents();
	})
	.on("send", function(data) {
	})
	.on("receive", function(data) {
	})
	.on("beforeSend", function(data) {
	})
	.on("beforeReceive", function(data) {
	});
};

MuuriStoryView.prototype.updateZIndexList = function(options) {
	var self = this;
	if(this.zIndexTiddler) {
		options = options || {};
		//do something that updates z-indices
		this.muuri.refreshItems(); //important
		var items = this.muuri.getItems();
		var itemColumns = [];
		var sortedArray = [];
		//get the x-coordinates for each column
		for(var i=0; i<items.length; i++) {
			var itemColumnsValue = items[i]._left !== null && items[i]._left !== undefined ? items[i]._left : items[i]._layout._currentLeft;
			if(itemColumns.indexOf(itemColumnsValue) === -1) {
				itemColumns.push(itemColumnsValue);
			}
		}
		//sort the columns left-to-right
		itemColumns.sort(function(valueA,valueB) {
			if(valueA >= valueB) return 1;
			if(valueA < valueB) return -1;
			return 0;
		});
		//now for each column, get the items that are members of it,
		//push to a temporary array
		//sort the temp array items so that by their _currentTop lowest to highest
		//push the sorted items to the final sortedItems array
		$tw.utils.each(itemColumns,function(columnValue) {
			var columnMembers = [];
			for(var k=0; k<items.length; k++) {
				var currLeft = items[k]._left !== null && items[k]._left !== undefined ? items[k]._left : items[k]._layout._currentLeft;
				if(currLeft === columnValue || (currLeft >= (columnValue - 5) && currLeft <= columnValue)) {
					// there's a small variation when item positions have not yet been fully
					// refreshed after they've moved ... some pixels, though they're still in
					// the same column
					// because of the min-width on tiddlers, 5px should be ok
					columnMembers.push(items[k]);
				}
			}
			columnMembers.sort(function(itemA,itemB) {
				var valueA = itemA._layout._currentTop !== null && itemA._layout._currentTop !== undefined ? itemA._layout._currentTop : itemA._top,
					valueB = itemB._layout._currentTop !== null && itemB._layout._currentTop !== undefined ? itemB._layout._currentTop : itemB._top;
				if(valueA >= valueB) return 1;
				if(valueA < valueB) return -1;
				return 0;
			});
			for(k=0; k<columnMembers.length; k++) {
				var itemTitle = self.getItemTitle(columnMembers[k]);
				sortedArray.push(itemTitle);
			}
		});
		//store the array in a tiddler-list that's used for applying z-indices
		var tiddler = this.listWidget.wiki.getTiddler(this.zIndexTiddler);
		this.listWidget.wiki.addTiddler(new $tw.Tiddler(
			this.listWidget.wiki.getCreationFields(),
			{title: this.zIndexTiddler},
			tiddler,
			{list: sortedArray},
			this.listWidget.wiki.getModificationFields()
		));
	}
};

MuuriStoryView.prototype.restoreIframeEvents = function() {
	if(this.iframePointerEventStyle !== undefined) {
		var iframes = this.listWidget.document.querySelectorAll("iframe");
		for(var i=0; i<iframes.length; i++) {
			iframes[i].style["pointer-events"] = this.iframePointerEventStyle;
		}
		this.iframePointerEventStyle = undefined;
	}
};

MuuriStoryView.prototype.inheritIframeEvents = function() {
	var iframes = this.listWidget.document.querySelectorAll("iframe");
	for(var i=0; i<iframes.length; i++) {
		if(iframes[i]) {
			if(this.iframePointerEventStyle === undefined) {
				this.iframePointerEventStyle = iframes[i].style["pointer-events"];
			}
			iframes[i].style["pointer-events"] = "none";
		}
	}
};

MuuriStoryView.prototype.removeAllListeners = function() {
	var items = this.muuri.getItems();
	for(var i=0; i<items.length; i++) {
		var element = items[i].getElement();
		this.removeResizeListener(element,function() {
			self.refreshMuuriGrid();
		});
	}
};

MuuriStoryView.prototype.refreshItemTitlesArray = function() {
	this.muuri.refreshItems();
	var items = this.muuri.getItems(),
			muuriItems = [];
	this.itemTitlesArray = [];
	for(var i=0; i<items.length; i++) {
		if(items[i]._width !== 0 && items[i]._height !== 0) {
			this.itemTitlesArray.push(this.getItemTitle(items[i]));
			muuriItems.push(items[i]);
		}
	}
	this.muuri._items = muuriItems;
	items = this.muuri.getItems();
	for(i=0; i<items.length; i++) {
		items[i]._id = i;
	}
};

MuuriStoryView.prototype.findListWidget = function(element) {
	var listWidgetChildren = this.listWidget.children;
	//find the widget corresponding to this element
	for(var i=0; i<listWidgetChildren.length; i++) {
		var listElement = listWidgetChildren[i] ? listWidgetChildren[i].findFirstDomNode() : null;
		if(listElement && (listElement === element)) {
			return(listWidgetChildren[i]);
		}
	}
	return null;
};

MuuriStoryView.prototype.getItemTitle = function(item) {
	var element = item.getElement();
	var widget = this.findListWidget(element);
	return widget ? widget.parseTreeNode.itemTitle : null;
};

MuuriStoryView.prototype.onDragReleaseEnd = function(item) {
	var items = this.muuri.getItems(),
			isReleasing = false;
	for (var i=0; i<items.length; i++) {
		if(items[i].isDragging() || items[i].isReleasing() || items[i].isShowing() || items[i].isHiding()) {
			isReleasing = true;
		}
	}
	if(isReleasing === false) {
		this.synchronizeGrid(true);
	}
};

MuuriStoryView.prototype.synchronizeGrid = function(refreshItemTitlesArray) {
	if(refreshItemTitlesArray) {
		this.refreshItemTitlesArray();
	}
	this.muuri.synchronize();
	var hasChanged = false;
	if(this.itemTitlesArray.length !== this.listWidget.list.length) {
		hasChanged = true;
	} else {
		for(var i=0; i<this.itemTitlesArray.length; i++) {
			if(this.itemTitlesArray[i] !== this.listWidget.list[i]) {
				hasChanged = true;
				break;
			}
		}
	}

	if(hasChanged) {
		this.listWidget.wiki.setText(this.storyListTitle,this.storyListField,undefined,this.itemTitlesArray);
	}
};

MuuriStoryView.prototype.getMuuriAttributes = function() {
	this.animationDuration = $tw.utils.getAnimationDuration();
	this.attachEvent = this.listWidget.document.attachEvent;
	this.isIE = $tw.browser.isIE;
	this.containerClass = this.listWidget.getAttribute("containerClass","tc-muuri-river");
	this.rounding = true;
	var itemClass = this.listWidget.getAttribute("itemClass","tc-tiddler-frame");
	if(itemClass === "" || itemClass === "*") {
		this.itemSelector = "*";
		this.itemClass = "tc-muuri-item";
	} else {
		var classes = itemClass.split(" ");
		this.itemSelector = "." + classes[0];
		this.itemClass = classes[0];
	}
	this.noDragTags = ["input","INPUT","textarea","TEXTAREA","button","BUTTON","select","SELECT"];
	this.dragSortInterval = parseInt(this.listWidget.getAttribute("dragSortInterval","100"));
	this.dragSortAction = this.listWidget.getAttribute("dragSortAction",this.storyListTitle === "$:/StoryList" ? this.listWidget.wiki.getTiddlerText(DRAGSORTACTION_CONFIG) : "move");
	this.dragSortThreshold = parseInt(this.listWidget.getAttribute("dragSortThreshold",this.storyListTitle === "$:/StoryList" ? this.listWidget.getTiddlerText(DRAGSORTTHRESHOLD_CONFIG) : "40"));
//	this.fillGaps = this.listWidget.getAttribute("fillGaps",this.listWidget.wiki.getTiddlerText(SEAMLESS_CONFIG)) === "yes";
	this.alignRight = this.listWidget.getAttribute("alignRight",this.listWidget.wiki.getTiddlerText(ALIGNRIGHT_CONFIG)) !== "no";
	this.alignBottom = this.listWidget.getAttribute("alignBottom",this.listWidget.wiki.getTiddlerText(ALIGNBOTTOM_CONFIG)) === "yes";
	this.dragEnabled = this.listWidget.getAttribute("selectText",this.listWidget.wiki.getTiddlerText(SELECTTEXT_CONFIG)) !== "yes";
	this.storyListTitle = this.listWidget.getAttribute("storyList","$:/StoryList");
	this.storyListField = this.listWidget.getAttribute("storyListField","list");
	this.zIndexTiddler = this.listWidget.getAttribute("zIndexTiddler",this.storyListTitle === "$:/StoryList" ? "$:/state/muuri/tiddlers/z-indices" : null);
	this.horizontal = false;
	this.itemTemplate = this.listWidget.getAttribute("template");
	this.itemEditTemplate = this.listWidget.getAttribute("editTemplate");
}

MuuriStoryView.prototype.createMuuriGrid = function() {
	var self = this;
	
	this.muuriOptions = this.collectMuuriOptions();
	var domNode = this.listWidget.parentDomNode;
	domNode.setAttribute("data-grid","muuri");
	this.muuri = new Muuri(domNode,self.muuriOptions);
	$tw.wiki.addEventListener("change",function(changes) {
		self.muuriRefresh(changes);
	});
	var items = this.muuri.getItems();
	for(var i=0; i<items.length; i++) {
		var element = items[i].getElement();
		this.itemTitlesArray.push(element.dataset.tiddlerTitle);
		this.addResizeListener(element,function() {
			self.refreshMuuriGrid();
		});
		this.addResizeListener(self.muuri._element,function() {
			self.refreshMuuriGrid();
		});
	}

	this.muuri.synchronizeGrid = function() {
		self.synchronizeGrid();
	};
	this.muuri.getItemTitle = function(item) {
		self.getItemTitle(item);
	};
};

MuuriStoryView.prototype.collectMuuriOptions = function() {
	var self = this;
	return {
		items: self.itemSelector,
		dragEnabled: self.dragEnabled,
		layout: {
			fillGaps: false,
			horizontal: self.horizontal,
			alignRight: self.alignRight,
			alignBottom: self.alignBottom,
			rounding: self.rounding
		},
		dragSortPredicate: {
			action: self.dragSortAction,
			threshold: self.dragSortThreshold
		},
		layoutEasing: easing,
		dragStartPredicate: function (item,e) {
			if (self.muuri._settings.dragEnabled) {
				if((e.target && e.target.tagName && (self.noDragTags.indexOf(e.target.tagName) > -1 || self.lookupDragTarget(e.target)) || self.detectWithinCodemirror(e) || !self.detectGridWithinGrid(e.target))) {
					return false;
				} else {
					return Muuri.ItemDrag.defaultStartPredicate(item,e);
				}
			} else {
				return false;
			}
		},
		dragSortInterval: self.dragSortInterval,
		showDuration: self.animationDuration,
		layoutDuration: self.animationDuration,
		layoutOnResize: true,
		containerClass: self.containerClass,
		itemClass: self.itemClass,
		itemDraggingClass: "tc-muuri-dragging",
		itemReleasingClass: "tc-muuri-releasing",
		itemPositioningClass: "tc-muuri-positioning"
	};
};

MuuriStoryView.prototype.detectWithinCodemirror = function(event) {
	var node = event.target;
	while(node) {
		if(node.classList && ((node.classList.contains("CodeMirror-scroll")) || (node.classList.contains("CodeMirror")))) {
			return true;
		}
		node = node.parentNode;
	}
	return false;
};

MuuriStoryView.prototype.lookupDragTarget = function(element) {
	var count = 0,
		node = element.parentNode;
	while(node && count < 10) {
		if(this.noDragTags.indexOf(node.tagName) > -1) {
			return true;
		}
		node = node.parentNode;
		count += 1;
	}
	return false;
};

MuuriStoryView.prototype.detectGridWithinGrid = function(element) {
	var gridNode = this.muuri.getItems()[0] ? this.muuri.getItems()[0].getGrid()._element : null;

	if(!gridNode) {
		return true;
	}
	var elementChildNodes = element.childNodes;
	var isCurrentGrid = false,
		foundGrid = false;
	
	if(elementChildNodes.length === 0) {
		return true;
	}
	$tw.utils.each(elementChildNodes,function(node) {
		while(node && !foundGrid) {
			if(node instanceof Element && node.getAttribute("data-grid") === "muuri") {
				//dragging within a grid
				//see if the found grid is the current grid node
				if(node !== gridNode) {
					foundGrid = true;
					isCurrentGrid = false;
				} else {
					isCurrentGrid = true;
					foundGrid = true;
				}
			}
			node = node.parentNode;
		}
	});
	return isCurrentGrid;
};

MuuriStoryView.prototype.resizeListener = function(e) {
	var win = e.target || e.srcElement;
	if (win.__resizeRAF__) $tw.pageScroller.cancelAnimationFrame.call(win,win.__resizeRAF__);
	win.__resizeRAF__ = $tw.pageScroller.requestAnimationFrame.call(win,function(){
		var trigger = win.__resizeTrigger__;
		$tw.utils.each(trigger.__resizeListeners__,function(fn){
			fn.call(trigger, e);
		});
	});
};

MuuriStoryView.prototype.addResizeListener = function(element,fn) {
	var self = this;
	if(element) {
		if(!element.__resizeListeners__) {
			element.__resizeListeners__ = [];
			if(this.attachEvent) {
				element.__resizeTrigger__ = element;
				element.attachEvent('onresize',self.resizeListener);
			}
			else {
				if(getComputedStyle(element).position == 'static') element.style.position = 'relative';
				var obj = element.__resizeTrigger__ = self.listWidget.document.createElement('object');
				obj.setAttribute('style', 'display: block; position: absolute; top: 0; left: 0; height: 100%; width: 100%; overflow: hidden; pointer-events: none; z-index: -1;');
				obj.__resizeElement__ = element;
				obj.onload = function(e) {
					obj.contentDocument.defaultView.__resizeTrigger__ = obj.__resizeElement__;
					obj.contentDocument.defaultView.addEventListener("resize",self.resizeListener);
				};
				obj.type = 'text/html';
				if(self.isIE) element.appendChild(obj);
				obj.data = 'about:blank';
				if(!self.isIE) element.appendChild(obj);
			}
			element.__resizeListeners__.push(fn);
		} else {
			element.__resizeListeners__.push(fn);
		}
	}
};

MuuriStoryView.prototype.removeResizeListener = function(element,fn) {
	if(element) {
		if(!element.__resizeListeners__) {
			element.__resizeListeners__ = [];
		}
		element.__resizeListeners__.splice(element.__resizeListeners__.indexOf(fn), 1);
		if(!element.__resizeListeners__.length) {
			if(this.attachEvent) element.detachEvent('onresize', this.resizeListener);
			else {
				this.listWidget.document.defaultView.removeEventListener('resize', this.resizeListener);
				element.__resizeTrigger__ = this.isNode(element.__resizeTrigger__) && element.__resizeTrigger__ !== undefined ? !element.removeChild(element.__resizeTrigger__) : undefined;
			}
		}
	}
};

MuuriStoryView.prototype.refreshMuuriGrid = function(item) {
	this.muuri.refreshItems();
	this.muuri._refreshDimensions();
	this.muuri.layout(); //no .layout(true), make tiddlers move, not jump instantly
};

MuuriStoryView.prototype.isNode = function(o) {
	return (
		typeof Node === "object" ? o instanceof Node : o && typeof o === "object" && typeof o.nodeType === "number" && typeof o.nodeName==="string"
	);
};

MuuriStoryView.prototype.insert = function(widget) {
	var self = this;
	var targetElement = widget.findFirstDomNode();
	if(!(targetElement instanceof Element)) {
		return;
	}
	this.refreshItemTitlesArray();
	var itemTitle = widget.parseTreeNode.itemTitle;
	var targetIndex = this.listWidget.findListItem(0,itemTitle);
	if(this.itemTitlesArray.indexOf(itemTitle) !== -1) {
		var index = this.itemTitlesArray.indexOf(itemTitle),
				items = this.muuri.getItems();
		//this.muuri.remove([items[index]],{removeElements: true, layout: false})
		this.muuri._items.splice(index,1);
		this.muuri.refreshItems();
	}
	this.muuri.add(targetElement,{index: targetIndex, instant: true});
	this.addResizeListener(targetElement,function() {
		self.refreshMuuriGrid();
	});
	this.refreshItemTitlesArray();
};

MuuriStoryView.prototype.remove = function(widget) {
	var self = this;
	var targetElement = widget.findFirstDomNode();
	var removeElement = function() {
		widget ? widget.removeChildDomNodes() : null;
	};
	if(!targetElement instanceof Element) {
		removeElement();
		return;
	}
	this.removeResizeListener(targetElement,function() {
		self.refreshMuuriGrid();
	});
	removeElement();
	this.muuri.refreshItems();
	this.muuri.remove([targetElement],{removeElements: true});
	this.muuri.layout();
	this.refreshItemTitlesArray();
};

MuuriStoryView.prototype.navigateTo = function(historyInfo) {
	var listElementIndex = this.listWidget.findListItem(0,historyInfo.title);
	if(listElementIndex === undefined) {
		return;
	}
	var listItemWidget = this.listWidget.children[listElementIndex],
		targetElement = listItemWidget.findFirstDomNode();
	// Abandon if the list entry isn"t a DOM element (it might be a text node)
	if(!(targetElement instanceof Element)) {
		return;
	}
	// Scroll the node into view
	this.listWidget.dispatchEvent({type: "tm-scroll", target: targetElement});
};

MuuriStoryView.prototype.muuriRefresh = function(changedTiddlers) {
	var self = this;
	var changedAttributes = this.listWidget.computeAttributes();
	if(changedTiddlers["$:/config/AnimationDuration"]) {
		this.muuri._settings.showDuration = this.muuri._settings.layoutDuration = this.animationDuration = $tw.utils.getAnimationDuration();
	}
	if(changedTiddlers[COLUMN_CONFIG]) {
		this.muuri.refreshItems();
		this.muuri.layout();
		this.muuri.synchronize();
	}
	if(changedTiddlers[SELECTTEXT_CONFIG] || changedAttributes.selectText) {
		this.muuri._settings.dragEnabled = this.dragEnabled = this.listWidget.getAttribute("selectText",this.listWidget.wiki.getTiddlerText(SELECTTEXT_CONFIG)) !== "yes";
		var items = this.muuri.getItems();
		var elements = [];
		for(var i=0; i<items.length; i++) {
			elements.push(items[i]._element);
		}
		this.muuri.remove(items,{removeElements:true,layout:false});
		this.muuri.add(elements,{layout:false});
		this.muuri.layout(true);
	}
	if(changedTiddlers[ALIGNRIGHT_CONFIG]) {
		this.muuri._settings.layout.alignRight = this.alignRight = this.listWidget.getAttribute("alignRight",this.listWidget.wiki.getTiddlerText(ALIGNRIGHT_CONFIG)) !== "no";
		this.muuri.refreshItems();
		this.muuri._refreshDimensions();
		this.muuri.layout();
	}
	if(changedTiddlers[ALIGNBOTTOM_CONFIG]) {
		this.muuri._settings.layout.alignBottom = this.alignBottom = this.listWidget.getAttribute("alignBottom",this.listWidget.wiki.getTiddlerText(ALIGNBOTTOM_CONFIG)) === "yes";
		this.muuri.refreshItems();
		this.muuri._refreshDimensions();
		this.muuri.layout();
	}
	if(changedTiddlers[SEAMLESS_CONFIG]) {
		this.muuri.refreshItems();
		this.muuri._refreshDimensions();
		this.muuri.layout();		
	}
	if(changedTiddlers[DRAGSORTACTION_CONFIG]) {
		this.muuri._settings.dragSortPredicate.action = this.dragSortAction = this.listWidget.getAttribute("dragSortAction",this.storyListTitle === "$:/StoryList" ? this.listWidget.wiki.getTiddlerText(DRAGSORTACTION_CONFIG) : "move");
	}
	if(changedTiddlers[DRAGSORTTHRESHOLD_CONFIG]) {
		this.muuri._settings.dragSortPredicate.threshold = this.dragSortThreshold = parseInt(this.listWidget.getAttribute("dragSortThreshold",this.storyListTitle === "$:/StoryList" ? this.listWidget.wiki.getTiddlerText(DRAGSORTTHRESHOLD_CONFIG) : "40"));		
	}
	if(changedTiddlers[this.itemTemplate] || changedTiddlers[this.itemEditTemplate]) {
		setTimeout(function(){
			self.listWidget.refreshSelf();
		},50);
	}
	return true;
}

exports.muuri = MuuriStoryView;

})();

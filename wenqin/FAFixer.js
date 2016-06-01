(function ($) {
	var jsav = new JSAV("av"), // Instance variable to store the JSAV algorithm visualization.
		jsavArray, // Instance variable to store the JSAV array (in which input strings are displayed).
		first = null, // Instance variable to store the first node clicked in "Add Edges" mode.
		selected = null, // Instance variable to store a node or edge that is clicked.
		label = null, // Instance variable to store the label clicked in "Edit Edges" mode.
		undoStack, // Instance variable to store a backup array of serialized graphs, loaded when the user clicks "Undo".
		redoStack, // Instance variable to store a backup array of serialized graphs, loaded when the user clicks "Redo".
		g, // Instance variable to store the current JSAV graph.
		lambda = String.fromCharCode(955), // Instance variable to store the JavaScript representation of lambda.
		epsilon = String.fromCharCode(949), // Instance variable to store the JavaScript representation of epsilon.
		emptystring = lambda, // Instance variable to store which empty string notation is being used.
		willRejectFunction = willReject; // Instance variable to indicate which traversal function to run (shorthand or no).

	var tests, currentExercise = 0, testCases;
	$.ajax({
  	url: "./fixerTests.json",
  	dataType: 'json',
  	async: false,
  	success: function(data) {
			tests = data;
  	}
	});
	console.log(tests);
	for (i = 0; i < tests.length; i++) {
		$("#exerciseLinks").append("<a href='#' id='" + i + "' class='links'>" + (i+1) + "</a>");
	}

	$("#testResults").hide();

	// Initializes a graph with automatic layout. Mainly called by Undo/Redo.
	var initialize = function(graph) {
		g = graph;
		initGraph({layout: "automatic"});
	};

	// Initializes a graph by parsing a JSON representation.
	var initGraph = function(opts) {
		// Remove the old graph, parse JSON, and initialize the new graph.
		$('.jsavgraph').remove();
		var gg = opts.graph ? opts.graph : jQuery.parseJSON(g);
		g = jsav.ds.fa($.extend({width: '90%', height: 440}, opts));
		// Add the JSON nodes to the graph.
		for (var i = 0; i < gg.nodes.length; i++) {
	    	var node = g.addNode('q' + i),
	    		offset = $('.jsavgraph').offset(),
	    		offset2 = parseInt($('.jsavgraph').css('border-width'), 10);
	    	// Expand the graph lengthways if we are loading it from a smaller window (conversionExersice.html / minimizationTest.html).
	    	if (localStorage['toConvert'] === "true" || localStorage['toMinimize'] === "true") {
	    		$(node.element).offset({top : parseInt(gg.nodes[i].top) + offset.top + offset2, left: (parseInt(gg.nodes[i].left) * 2) + offset.left + offset2});
	    	}
	    	else {
	    		$(node.element).offset({top : parseInt(gg.nodes[i].top) + offset.top + offset2, left: parseInt(gg.nodes[i].left) + offset.left + offset2});
	    	}
	    	// Make the node initial if it is the initial node.
	    	if (gg.nodes[i].i) {
	    		g.makeInitial(node);
	    	}
	    	// Make the node a final state if it is a final state.
	    	if (gg.nodes[i].f) {
	    		node.addClass("final");
	   		}
	   		// Add the state label (if applicable) and update its position on the graph.
	   		node.stateLabel(gg.nodes[i].stateLabel);
	   		node.stateLabelPositionUpdate();
	  	}
	  	// Add the JSON edges to the graph.
	  	for (var i = 0; i < gg.edges.length; i++) {
	   		if (gg.edges[i].weight !== undefined) {
	   			// Any instances of lambda or epsilon need to be converted from HTML format to JS format.
	   			var w = delambdafy(gg.edges[i].weight);
	   			w = checkEmptyString(w);
	   			var edge = g.addEdge(g.nodes()[gg.edges[i].start], g.nodes()[gg.edges[i].end], {weight: w});
       		}
	   		else {
	   			var edge = g.addEdge(g.nodes()[gg.edges[i].start], g.nodes()[gg.edges[i].end]);
	   		}
	   		edge.layout();
	   	}
	   	// Set whether or not shorthand mode is enabled.
	    // Clear anything in local storage as we do not need it anymore.
	    // (Local storage is used to transfer graph information between different windows. It is used by conversionExercise.html and minimizationTest.html.)
	    localStorage['toConvert'] = false;
	    localStorage['toMinimize'] = false;
	    finalize();
    };

    // Update input character alphabet, display the graph, and add click handlers.
    var finalize = function() {
    	updateAlphabet();
	    jsav.displayInit();
	    g.click(nodeClickHandler);
			g.click(edgeClickHandler, {edge: true});
			$('.jsavnode').contextmenu(showMenu);
			$('.jsavgraph').click(graphClickHandler);
			$('.jsavedgelabel').click(labelClickHandler);
    };

    // Function to switch which empty string is being used (lambda or epsilon) if a loaded graph uses the opposite representation to what the editor is currently using.
    var checkEmptyString = function(w) {
    	var wArray = w.split("<br>");
    	// It is necessary to check every transition on the edge.
    	for (var i = 0; i < wArray.length; i++) {
    		if ((wArray[i] == lambda || wArray[i] == epsilon) && wArray[i] != emptystring) {
    			emptyString();
    		}
    	}
    	return wArray.join("<br>");
    };

    // Sets click handlers for when the user clicks on the JSAV graph.
	var graphClickHandler = function(e) {
		if ($("#rmenu").is(":visible")) {
			hideRMenu();
		}
		else if ($(".jsavgraph").hasClass("addNodes")) {
			// If in "Add Nodes" mode, save the graph and add a node.
			saveFAState();
			executeAddNode(g, e.pageY, e.pageX);
			$('.jsavnode').off('contextmenu').contextmenu(showMenu);
		} 
		else if ($('.jsavgraph').hasClass('moveNodes') && selected != null) {
			// If in "Move Nodes" mode, and a node has already been selected, save the graph and move the node.
			saveFAState();
			executeMoveNode(g, selected, e.pageY, e.pageX);
			selected.unhighlight();
			selected = null;
			e.stopPropagation();
			jsav.umsg('Click a node.');
		}
	};

	// Sets click handlers for when the user clicks on a JSAV node.
	var nodeClickHandler = function(e) {	
		if ($(".jsavgraph").hasClass("editNodes")) {
			// If in "Edit Nodes" mode, open the custom prompt box to edit the selected node.
			selected = this;
			selected.highlight();
			var Prompt = new FANodePrompt(updateNode);
			Prompt.render(selected.value(), selected.hasClass('start'), selected.hasClass('final'), selected.stateLabel());
			selected.unhighlight();
		}
		else if ($(".jsavgraph").hasClass("addEdges")) {
			if (!$(".jsavgraph").hasClass("working")) {
				// If in "Add Edges" mode, and this is the first node clicked, highlight it and store a pointer to it.
				first = this;
				first.highlight();
				$('.jsavgraph').addClass("working");
				jsav.umsg('Select a node to make an edge to.');
   			}
   			else {
   				// If in "Add Edges" mode and this is the second node clicked, open the custom prompt box to add an edge between the nodes.
   				selected = this;
   				selected.highlight();
   				var Prompt = new EdgePrompt(createEdge, emptystring);
   				Prompt.render("");
				$('.jsavgraph').removeClass("working");
				first.unhighlight();
				selected.unhighlight();
				jsav.umsg('Click a node.');
   			}
		}
		else if ($('.jsavgraph').hasClass('moveNodes')) {
			// If in "Move Nodes" mode, selected the node as the node to be moved.
			if (selected) {
				selected.unhighlight();
			}
			selected = this;
			selected.highlight();
			jsav.umsg('Click to place node.');
			e.stopPropagation();
		}
		else if ($('.jsavgraph').hasClass('deleteNodes')) {
			// If in "Delete Nodes" mode, save the graph and delete the node.
			saveFAState();
			executeDeleteNode(g, this);
			updateAlphabet();
			checkAllEdges();
		}
	};

	// Sets click handler for when the user clicks a JSAV edge.
	var edgeClickHandler = function(e) {
		if ($('.jsavgraph').hasClass('deleteNodes')) {
			// If in "Delete Nodes" mode (which also serves to delete edges), save the graph and delete the edge.
			saveFAState();
			executeDeleteEdge(g, this);
			updateAlphabet();
			checkAllEdges();
		}
	};

	// Sets click handler for when the user clicks a JSAV edge label.
	var labelClickHandler = function(e) {
		if ($(".jsavgraph").hasClass("editNodes")) {
			// If in "Edit Nodes" mode (which also serves to edit edges), open the custom prompt box to edit the edge.
			label = this;
			var values = $(label).html().split('<br>');
			var Prompt = new EdgePrompt(updateEdge, emptystring);
   			Prompt.render(values);
		}
	};

	// Called by the edit node custom prompt box to save the graph and update the node upon clicking "OK".
	function updateNode(initial_state, final_state, node_label) {
		saveFAState();
		executeEditFANode(g, selected, initial_state, final_state, node_label);
	};

	// Called by the add edge custom prompt box to save the graph and create the edge upon clicking "Done".
	function createEdge(edge_label) {
		saveFAState();
		var edge = executeAddEdge(g, first, selected, edge_label);
		$(edge._label.element).click(labelClickHandler);
		// This new edge does need its edge label click handler to be set individually.
		updateAlphabet();
		checkEdge(edge);
	};

	// Called by the edit edge custom prompt box to save the graph and update the edge upon clicking "Done".
	function updateEdge(edge_label) {
		saveFAState();
		executeEditEdge(g, label, edge_label);
		updateAlphabet();
		checkAllEdges();
		// Check to see if shorthand notation is disabled, and whether the transitions on this edge are therefore allowed (i.e. only one character long).
	};

	// Function to check if a single edge contains any transitions of more than one input symbol in sequence.
	// Generates warnings only when shorthand mode is disabled.
	function checkEdge(edge) {
		var weights = edge.weight().split("<br>");
		for (var i = 0; i < weights.length; i++) {
			if (weights[i].length > 1) {
				document.getElementById("begin").disabled = true;
				break;
			}
		}
	};

	// Function to check if any graph edge contains any transitions of more than one input symbol in sequence.
	// Generates warnings only when shorthand mode is disabled.
	function checkAllEdges() {
		if (g.shorthand) {
			return;
		}
		document.getElementById("begin").disabled = false;
		var edges = g.edges();
		for (var next = edges.next(); next; next = edges.next()) {
			next.removeClass('testingShorthand');
			var weights = next.weight().split("<br>");
			for (var i = 0; i < weights.length; i++) {
				if (weights[i].length > 1) {
					next.addClass('testingShorthand');
					document.getElementById("begin").disabled = true;
				}
			}
		}
	};

	// Function to automatically update the alphabet display at the bottom of the view.
	// Called whenever a graph is loaded, an action is undone/redone, or any edges are add/edited/removed.
	var updateAlphabet = function() {
		g.updateAlphabet();
		$("#alphabet").html("" + Object.keys(g.alphabet).sort());
	};

	// Function to switch to "Add Nodes" mode.
	// Triggered by clicking the "Add Nodes" button.
	var addNodes = function() {
		removeModeClasses();
		removeND();
		$('.jsavgraph').addClass("addNodes");
		$("#mode").html('Adding nodes');
		jsav.umsg('Click to add nodes.');
	};

	// Function to switch to "Add Edges" mode.
	// Triggered by clicking the "Add Edges" button.
	var addEdges = function() {
		removeModeClasses();
		removeND();
		$(".jsavgraph").addClass("addEdges");
		$("#mode").html('Adding edges');
		jsav.umsg('Click a node.');
	};

	// Function to switch to "Move Nodes" mode.
	// Triggered by clicking the "Move Nodes" button.
	var moveNodes = function() {
		removeModeClasses();
		removeND();
		$('.jsavgraph').addClass('moveNodes');
		$("#mode").html('Moving nodes');
		jsav.umsg('Click a node.');
	};

	// Function to switch to "Edit Nodes" mode.
	// Triggered by clicking the "Edit Nodes/Edges" button.
	var editNodes = function() {
		removeModeClasses();
		removeND();
		$('.jsavgraph').addClass('editNodes');
		$("#mode").html('Editing nodes and edges');
		jsav.umsg('Click a node or edge label.');
	};

	// Function to switch to "Delete Nodes" mode.
	// Triggered by clicking the "Delete Nodes/Edges" button.
	var deleteNodes = function() {
		removeModeClasses();
		removeND();
		$('.jsavgraph').addClass('deleteNodes');
		$("#mode").html('Deleting nodes and edges');
		jsav.umsg('Click a node or edge to delete it.');
		// Expand the edges to make them easier to click.
		expandEdges();
	};

	// Disable all editing modes so that click handlers do not fire.
	// Called when the user switches editing modes, or otherwise presses a button that changes the view.
	var removeModeClasses = function() {
		// Clear all superfluous or otherwise outdated information on the page.
		$('.arrayPlace').empty();
		$('#download').html('');
		$("#mode").html('');
		jsav.umsg('');
		// Unselect and unhighlight any selected nodes or edges.
		if (first) {
			first.unhighlight();
			first = null;
		}
		if (selected) {
			selected.unhighlight();
			selected = null;
		}
		if ($(".jsavgraph").hasClass("deleteNodes")) {
			$(".jsavgraph").removeClass("deleteNodes");
			// Return edges to normal size.
			collapseEdges();
		}
		else {
			$(".jsavgraph").removeClass("addNodes");
			$(".jsavgraph").removeClass("addEdges");
			$(".jsavgraph").removeClass("editNodes");
			$(".jsavgraph").removeClass("moveNodes");
			$(".jsavgraph").removeClass("working");
		}
	};

	// Function to enlarge edges in "Delete Nodes/Edges" mode, making them easier to click.
	var expandEdges = function() {
		var edges = g.edges();
		for (var next = edges.next(); next; next = edges.next()) {
			next.g.element.addClass('edgeSelect');
		}
	};

	// Function to shrink edges back to normal size when switching out of "Delete Nodes/Edges" mode.
	var collapseEdges = function() {
		var edges = g.edges();
		for (var next = edges.next(); next; next = edges.next()) {
			next.g.element.removeClass('edgeSelect');
		}
	};

	// Saves the graph before calling the function to switch the empty string symbol.
	// Triggered by clicking the "Lambda/Epsilon Mode" button.
	var switchEmptyString = function() {
		removeModeClasses();
		removeND();
		saveFAState();
		if(!emptyString()) {
			// If there are no empty strings on the graph, nothing was changed. Remove the saved graph from the undo stack.
			undoStack.pop();
			if(undoStack.length == 0) {
				document.getElementById("undoButton").disabled = true;
			}
		}
	};

	// Function to switch the empty string representation of the graph (lambda <-> epsilon).
	// Returns true if this alters the graph (i.e. if any empty string transitions currently exist).
	var emptyString = function() {
		document.getElementById("epsilonButton").innerHTML = emptystring + " Mode";
		var graphChanged = false;
		if (emptystring === lambda) {
			graphChanged = updateTransitions(epsilon);
			emptystring = epsilon;
		}
		else {
			graphChanged = updateTransitions(lambda);
			emptystring = lambda;
		}
		document.getElementById("lambdaButton").innerHTML = "Highlight " + emptystring + "-Transitions";
		return graphChanged;
	};

	// Function to loop through the graph and replace all instances of the empty string with a different character.
	// Used to switch between lambda and epsilon.
	var updateTransitions = function(greekLetter) {
		var graphChanged = false;
		var edges = g.edges();
		for (var next = edges.next(); next; next = edges.next()) {
			var weights = next.weight().split("<br>");
			for (var i = 0; i < weights.length; i++) {
				if (weights[i] === emptystring) {
					weights[i] = greekLetter;
					graphChanged = true;
				}
			}
			next.weight(weights.join("<br>"));
		}
		return graphChanged;
	};

	// Function that checks graph for nondeterminism.
	// Any nodes with multiple identical outgoing edges or lambda transitions are highlighted blue.
	// Triggered by clicking the "Highlight Nondeterminism" button.
	var testND = function() {
		removeModeClasses();
		var nd = false;
		var nodes = g.nodes();
		for(var next = nodes.next(); next; next = nodes.next()) {
			var findLambda = false;
			var findMultiple = false;
			var transition = g.transitionFunction(next, emptystring);
			if (transition.length > 0) {
				findLambda = true;
			}
			for (var key in g.alphabet) {
				// If edges have sequences of input symbols on them, only the first one matters.
				// Reason why is because this is the outgoing edge input symbol for the node.
				transition = g.transitionFunctionMultiple(next, key);
				if (transition.length > 1) {
					findMultiple = true;
					break;
				}
			}
			if (findLambda || findMultiple) {
				next.toggleClass('testingND');
				nd = true;
			}
		}
		return nd;
	};

	// Function that checks graph for lambda transitions, which are highlighted red.
	// Triggered by clicking the "Highlight Lambda/Epsilon Transitions" button.
	var testLambda = function() {
		removeModeClasses();
		var edges = g.edges();
		for (var next = edges.next(); next; next = edges.next()) {
			wSplit = next.weight().split('<br>');
			for (var i = 0; i < wSplit.length; i++) {
				if (wSplit[i] == emptystring) {
					next.g.element.toggleClass('testingLambda');
					break;
				}
			}
		}
	};

	// Undoes the effects of testND and testLambda, unhighlighting all nodes and edges.
	var removeND = function() {
		var nodes = g.nodes();
		for(var next = nodes.next(); next; next = nodes.next()) {
			next.removeClass("testingND");
		}
		var edges = g.edges();
		for (var next = edges.next(); next; next = edges.next()) {
			next.g.element.removeClass("testingLambda");
		}
	};

	// Saves the graph, then reconfigures the layout automatically.
	// Triggered by clicking the "Layout" button.
	var layoutGraph = function() {
		removeModeClasses();
		removeND();
		saveFAState();
		g.layout();
	};

	// Exit out of all editing modes and prepare the view for the input string JSAV array.
	var readyTraversal = function() {
		removeModeClasses();
		jsav.umsg('Click on an input to trace its traversal.');
	};

	// Click handler for the JSAV array.
	function arrayClickHandler(index) {
		play(this.value(index));
	};

	// Function to reset the size of the undo stack and the redo stack.
	// Since both of them are empty, both buttons are also disabled.
	// Called whenever the user loads a new graph.
	function resetUndoButtons () {
		document.getElementById("undoButton").disabled = true;
		document.getElementById("redoButton").disabled = true;
		undoStack = [];
		redoStack = [];
	};

	// Function to save the state of the graph and push it to the undo stack.
	// Called whenever any graph manipulation is made.
	// Note that a size restriction of 20 is imposed on both the undo stack and the redo stack.
	function saveFAState () {
		var data = serialize(g);
		undoStack.push(data);
		redoStack = [];
		document.getElementById("undoButton").disabled = false;
		document.getElementById("redoButton").disabled = true;
		if (undoStack.length > 20) {
			undoStack.shift();
		}
	};

	// Function to undo previous action by reinitializing the graph that existed before it was performed.
	// Pushes the current graph to the redo stack and enables the redo button.
	// Triggered by clicking the "Undo" button.
	function undo () {
		removeModeClasses();
		var data = serialize(g);
		redoStack.push(data);
		data = undoStack.pop();
		initialize(data);
		document.getElementById("redoButton").disabled = false;
		if(undoStack.length == 0) {
			document.getElementById("undoButton").disabled = true;
		}
	};

	// Function to redo previous action by reinitializing the graph that existed after it was performed.
	// Pushes the current graph to the undo stack and, if applicable, enables the undo button.
	// Enabled by clicking the "Undo" button, and triggered by clicking the "Redo" button.
	function redo () {
		removeModeClasses();
		var data = serialize(g);
		undoStack.push(data);
		data = redoStack.pop();
		initialize(data);
		document.getElementById("undoButton").disabled = false;
		if(redoStack.length == 0) {
			document.getElementById("redoButton").disabled = true;
		}
	};

	// Handler for initializing graph upon loading the web page.
	// Loads the graph from conversionExercise.html / minimizationTest.html if we are navigating here from those pages.
	// Otherwise simply initializes a default data set.
	function onLoadHandler() {
		var data;
		if (localStorage['toConvert'] === "true") {
			data = localStorage['converted'];
		}
		else if (localStorage['toMinimize'] === "true") {
			data = localStorage['minimized'];
		}
		else {
			data = '{"nodes":[],"edges":[]}';
		}
		initialize(data);
		resetUndoButtons();
		updateExercise(currentExercise);
	};

	// Function to serialize the current graph to XML format.
	var serializeGraphToXML = function (graph) {
		var text = '<?xml version="1.0" encoding="UTF-8"?>';
	    text = text + "<structure>";
	    text = text + "<type>fa</type>"
	    text = text + "<automaton>"
	    var nodes = graph.nodes();
	    // Iterate over the nodes and add them all to the serialization.
	    for (var next = nodes.next(); next; next = nodes.next()) {
	    	var left = next.position().left;
		    var top = next.position().top;
		    var i = next.hasClass("start");
		    var f = next.hasClass("final");
		    var label = next.stateLabel();
		    text = text + '<state id="' + next.value().substring(1) + '" name="' + next.value() + '">';
		    text = text + '<x>' + left + '</x>';
		    text = text + '<y>' + top + '</y>';
		    if (label) {
		    	text = text + '<label>' + label + '</label>';
		    }
		    if (i) {
		    	text = text + '<initial/>';
		    }
		    if (f) {
		    	text = text + '<final/>';
		    }
	    	text = text + '</state>';
	    }
	    var edges = graph.edges();
	    // Now iterate over the edges and do the same with them.
	    for (var next = edges.next(); next; next = edges.next()) {
	    	var fromNode = next.start().value().substring(1);
	    	var toNode = next.end().value().substring(1);
	    	var w = next.weight().split('<br>');
	    	for (var i = 0; i < w.length; i++) {
	    		text = text + '<transition>';
	    		text = text + '<from>' + fromNode + '</from>';
	    		text = text + '<to>' + toNode + '</to>';
	    		if (w[i] === emptystring) {
	    			text = text + '<read/>';
	    		}
	    		else {
	    			text = text + '<read>' + w[i] + '</read>';
	    		}
	    		text = text + '</transition>';
	    	}
	    }
	    text = text + "</automaton></structure>"
	    // This XML format mimics that used by JFLAP 7, and is thus compatible with the software.
	    return text;
	};

	// Function to save the current graph as an XML file and provide a download link for it.
	// Triggered by clicking the "Save" button.
	// Note that there are some browser-specific differences in how this is handled.
	var saveXML = function () {
		removeModeClasses();
		var downloadData = "text/xml;charset=utf-8," + encodeURIComponent(serializeGraphToXML(g));
    	$('#download').html('<a href="data:' + downloadData + '" target="_blank" download="fa.xml">Download FA</a>');
    	jsav.umsg("Saved");
	};

	// Function to parse an XML file and initialize a graph from it.
  	var parseFile = function (text) {
	    var parser,
	        xmlDoc;
	    if (window.DOMParser) {
	      	parser = new DOMParser();
	      	xmlDoc = parser.parseFromString(text,"text/xml");
	    }
	    else {
	      	xmlDoc = new ActiveXObject("Microsoft.XMLDOM");
	      	xmlDoc.async = false;
	      	xmlDoc.loadXML(txt);
	    }
	    if (!xmlDoc.getElementsByTagName("type")[0]) {
	    	// This file is not a file that can be parsed.
	      	window.alert('File does not contain an automaton.');
	      	return;
	    }
	    if (xmlDoc.getElementsByTagName("type")[0].childNodes[0].nodeValue !== 'fa') {
	    	// This file was created by a different automaton editor.
	    	window.alert('File does not contain a finite automaton.');
	      	return;
	    }
	    else {
	    	if (g) {
				g.clear();
			}
			g = new jsav.ds.fa({width: '90%', height: 440, layout: "automatic"});
			var nodeMap = {};			// map node IDs to nodes
	      	var xmlStates = xmlDoc.getElementsByTagName("state");
	      	xmlStates = _.sortBy(xmlStates, function(x) { return x.id; })
	      	var xmlTrans = xmlDoc.getElementsByTagName("transition");
	      	// Iterate over the nodes and initialize them.
	      	for (var i = 0; i < xmlStates.length; i++) {
	        	var x = Number(xmlStates[i].getElementsByTagName("x")[0].childNodes[0].nodeValue);
	        	var y = Number(xmlStates[i].getElementsByTagName("y")[0].childNodes[0].nodeValue);
	        	var newNode = g.addNode({left: x, top: y});
	        	// Add the various details, including initial/final states and state labels.
	        	var isInitial = xmlStates[i].getElementsByTagName("initial")[0];
	        	var isFinal = xmlStates[i].getElementsByTagName("final")[0];
	        	var isLabel = xmlStates[i].getElementsByTagName("label")[0];
	        	if (isInitial) {
	        		g.makeInitial(newNode);
	        	}
	        	if (isFinal) {
	        		newNode.addClass('final');
	        	}
	        	if (isLabel) {
	        		newNode.stateLabel(isLabel.childNodes[0].nodeValue);
	        	}
	        	nodeMap[xmlStates[i].id] = newNode;
	        	newNode.stateLabelPositionUpdate();
	      	}
	      	// Iterate over the edges and initialize them.
	      	for (var i = 0; i < xmlTrans.length; i++) {
	      		var from = xmlTrans[i].getElementsByTagName("from")[0].childNodes[0].nodeValue;
	      		var to = xmlTrans[i].getElementsByTagName("to")[0].childNodes[0].nodeValue;
	      		var read = xmlTrans[i].getElementsByTagName("read")[0].childNodes[0];
	      		// Empty string always needs to be checked for.
	      		if (!read) {
	      			read = emptystring;
	      		}
	      		else {
	      			read = read.nodeValue;
	      		}
	      		var edge = g.addEdge(nodeMap[from], nodeMap[to], {weight: read});
	      		edge.layout();
	      	}
			finalize();
	    }
	};

	// Function to parse the XML file once the File Reader is done reading it.
  	var waitForReading = function (reader) {
    	reader.onloadend = function(event) {
        	var text = event.target.result;
        	parseFile(text);
    	}
  	};

  	// Function to load an XML file from the user's computer.
  	// Triggered upon changing the file in the "Choose File" button.
  	// Note that there are some browser-specific differences with what form this "Choose File" button takes.
  	var loadXML = function () {
    	var loaded = document.getElementById('loadFile');
    	var file = loaded.files[0],
        	reader = new FileReader();
    	waitForReading(reader);
    	reader.readAsText(file);
  	};

	// Function to convert an FA to a Right-Linear Grammar.
	// Triggered by clicking the "Convert to Right-Linear Grammar" button.
	// Currently only works in certain browsers (not Safari).
	var convertToGrammar = function () {
		// by default sets S to be the start variable
		var variables = "SABCDEFGHIJKLMNOPQRTUVWXYZ";
		var s = g.initial;
		var newVariables = [s];
		var nodes = g.nodes();
		var arrow = String.fromCharCode(8594);
		var converted = [];
		// quit if the FA is too large for conversion
		if (g.nodeCount() > 26) {
			window.alert('The FA must have at most 26 states to convert it into a grammar!');
			return;
		}
		for (var next = nodes.next(); next; next = nodes.next()) {
			if (!next.equals(s)) {
				newVariables.push(next);
			}
		}
		var finals = [];
		for (var i = 0; i < newVariables.length; i++) {
			var edges = newVariables[i].getOutgoing();
			for (var j = 0; j < edges.length; j++) {
				var toVar = variables[newVariables.indexOf(edges[j].end())];
				var weight = edges[j].weight().split("<br>");
				for (var k = 0; k < weight.length; k++) {
					var terminal = weight[k];
					if (weight[k] === emptystring) {
						terminal = "";
					}
					converted.push(variables[i] + arrow + terminal + toVar);
				}
			}
			if (newVariables[i].hasClass('final')) {
				finals.push(variables[i] + arrow + emptystring);
			}
		}
		converted = converted.concat(finals);
		// save resulting grammar as an array of strings 
		// (same format as how the grammar test exports grammars to local storage)
		localStorage['grammar'] = converted;
		// open grammar
		window.open("../../shkim/grammarTest.html");
	};

	// Function to convert an NFA to a DFA.
	// Triggered by clicking the "Convert to DFA" button.
	// Currently incomplete - does not work as intended.
	var convertToDFA = function() {
		localStorage['convertNFA'] = true;
		localStorage['toConvert'] = serialize(g);
		window.open("../../shkim/conversionExercise.html");
	};

	// Function to convert a complete DFA to a minimum-state DFA.
	// Checks for nondeterminism, but currently does not check the completeness of the DFA.
	// Triggered by clicking the "Minimize DFA" button.
	var minimizeDFA = function() {
		removeND();
		if (testND()) {
			testLambda();
			window.alert("This Finite Automaton is nondeterministic.\nPlease convert to DFA before minimizing.");
			return;
		}
		window.alert("Beware that the minimization algorithm will fail on an incomplete DFA.");
		localStorage['minimizeDFA'] = true;
		localStorage['toMinimize'] = serialize(g);
		window.open("../../shkim/minimizationTest.html");
	};

	var testWithExpression = function() {
		if (g.initial == null) {
			window.alert("FA traversal requires an initial state.");
			return;
		}
		$("#testResults").empty();
		$("#testResults").append("<tr><td>Test Case</td><td>Standard Answer</td><td>Result</td></tr>");
		var count = 0;
		for (i = 0; i < testCases.length; i++) {
			var testCase = testCases[i];
			var input = Object.keys(testCase)[0];
			console.log(input);
			var inputResult = willReject(g, input);
			console.log(inputResult);
			console.log(testCase[input]);
			if (inputResult !== testCase[input]) {
				$("#testResults").append("<tr><td>" + input + "</td><td>" + (testCase[input] ? "Accept" : "Reject") + "</td><td class='correct'>Correct</td></tr>");
				count++;
			}
			else {
				$("#testResults").append("<tr><td>" + input + "</td><td>" + (testCase[input] ? "Accept" : "Reject") + "</td><td class='wrong'>Wrong</td></tr>");
			}
		}
		$("#percentage").text("Correct cases: " + count + " / " + testCases.length);
		$("#percentage").show();
		$("#testResults").show();
		window.scrollTo(0,document.body.scrollHeight);
	};

	var toExercise = function() {
		currentExercise = this.getAttribute('id');
		updateExercise(currentExercise);
	};
	
	var updateExercise = function(id) {
		var exercise = tests[id];
		console.log(exercise);
		$("#expression").text(exercise["expression"]);
		$(".links").removeClass("currentExercise");
		$("#" + currentExercise).addClass("currentExercise");
		testCases = exercise["testCases"];
		initGraph({graph: exercise["graph"], layout: "automatic"});
		$("#testResults").hide();
		$("#percentage").hide();
	};

	//displayRightClickMenu is in Commands.js
	var showMenu = function(e) {
		var selected = $(this);
		displayRightClickMenu(g, selected, e);
	}

var hideRMenu = function() {
	var nodes = g.nodes();
	for (var node = nodes.next(); node; node = nodes.next()) {
		node.unhighlight();
	}
	$("#rmenu").hide();
};

var toggleInitial = function(g, node) {
	$("#rmenu").hide();
	node.unhighlight();
	if (node.equals(g.initial)) {
		g.removeInitial(node);
	}
	else {
		if (g.initial) {
			alert("There can only be one intial state!");
		} else {
			g.makeInitial(node);
		}
	}
};

var toggleFinal = function(g, node) {
	if (node.hasClass("final")) {
		node.removeClass("final");
	}
	else {
		node.addClass("final");
	}
	$("#rmenu").hide();
	node.unhighlight();
};

var changeLabel = function(node) {
	$("#rmenu").hide();
	var nodeLabel = prompt("How do you want to label it?");
	if (!nodeLabel) {
		nodeLabel = "";
	}
	node.stateLabel(nodeLabel);
	node.stateLabelPositionUpdate();
	node.unhighlight();
}

var clearLabel = function(node) {
	$("#rmenu").hide();
	node.unhighlight();
	node.stateLabel("");
}

var deleteNode = function(g, node) {
	$("#rmenu").hide();
	node.unhighlight();
	saveFAState();
	executeDeleteNode(g, node);
	updateAlphabet();
	checkAllEdges();
}

var displayRightClickMenu = function(g, selected, e) {
	//find faState object with jQuery selected object
	var node = g.getNodeWithValue(selected.attr('data-value'));
	node.highlight();

	e.preventDefault();
	//make menu appear where mouse clicks
	$("#rmenu").css({left: selected.offset().left + e.offsetX, top: selected.offset().top + e.offsetY});

	$("#rmenu").show();
	if (node.equals(g.initial)) {
		$("#makeInitial").html("&#x2713;Initial");
	}
	else {
		$("#makeInitial").html("Initial");
	}
	if (node.hasClass("final")) {
		$("#makeFinal").html("&#x2713;Final");
	}
	else {
		$("#makeFinal").html("Final");
	}
	//off and on to avoid binding event more than once
	$("#makeInitial").off('click').click(function() {
			toggleInitial(g, node);
	});
	$("#makeFinal").off('click').click(function() {
			toggleFinal(g, node);
	});
	$("#deleteNode").off('click').click(function() {
			deleteNode(g, node);
	});
	$("#changeLabel").off('click').click(function() {
			changeLabel(node);
	});
	$("#clearLabel").off('click').click(function() {
			clearLabel(node);
	});
};

	//cancel all current options
	function cancel() {
		$(".jsavgraph").removeClass("addNodes").removeClass("moveNodes").removeClass("editNodes").removeClass("deleteNodes").removeClass("working");
		jsav.umsg("");
		$("#mode").html("");
		collapseEdges();
	}
	
	$("#rmenu").load("./rmenu.html");
	$("#rmenu").hide();

	onLoadHandler();

	// Button click handlers.
	$('#begin').click(testWithExpression);
	$('#saveButton').click(saveXML);
	$('#loadFile').change(loadXML);
	$('#undoButton').click(undo);
	$('#redoButton').click(redo);
	$("#cancelButton").click(cancel);
	$('#nodeButton').click(addNodes);
	$('#edgeButton').click(addEdges);
	$('#moveButton').click(moveNodes);
	$('#editButton').click(editNodes);
	$('#deleteButton').click(deleteNodes);
	$('#layoutButton').click(layoutGraph);
	$('.links').click(toExercise);
	$(document).click(hideRMenu);
	$(document).keyup(function(e) {
		if (e.keyCode === 13) console.log(serialize(g));
  	if (e.keyCode === 27) cancel();   // esc
	});
}(jQuery));
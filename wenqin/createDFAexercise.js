(function ($) {
	var problems = [],
			testCaseNumbers = {1: 1}, //problem -> number of test cases
			problemCount = 1,
			resultCount = 1;

	function generatejson() {
		problems = [];
		$("fieldset").each(problemInfo);
		var json = JSON.stringify(problems);
		var downloadData = 'data:text/json;charset=utf8,' + encodeURIComponent(json);
		$('#download').html('<a href="data:' + downloadData + '" target="_blank" download="dfaExercises.json">Download Exercises JSON File</a>');
	}
	
	function problemInfo() {
		var problem = {
    	expression: "",
    	testCases: []
		};
		problem.expression = $(this).find("input[name='expression']")[0].value;
		$(this).find(".testCase").each(function() {
			var _case = {},
					testString = $(this).find("input[name='testString']")[0].value,
					result = $(this).find("input[checked]")[0].value;
			_case[testString] = result;
			problem.testCases.push(_case);
		});
		problems.push(problem);
	}

	function addProblem() {
		problemCount++;
		resultCount++;
		$("#problems").append(""+
			"<fieldset id='" + problemCount + "'>" + 
				"<legend>Problem " + problemCount + "</legend>" + 
					"<span>Expression: </span>" + 
					"<input type='text' name='expression'>"+
					"<br>"+
					"<div class='testCases'>" + 
					"<div class='testCase'>"+
						"<span>Test Case 1: </span>"+
						"<span>String: </span><input type='text' name='testString'>"+
						"<input type='radio' name='result" + resultCount + "' value='true' checked> <span>Accept</span>"+
						"<input type='radio' name='result" + resultCount + "' value='false'> <span>Reject</span>"+
						"<br>" + 
					"</div>"+
					"</div>"+
			"</fieldset>");
		var addCaseButton = $("<button type='button' id='addTestCase'>Add another test case</button>");
		addCaseButton.click(addCase);
		$("fieldset[id='" + problemCount + "']").append(addCaseButton);
		testCaseNumbers[problemCount] = 1;
	}

	function addCase() {
		var button = $(this);
		var thisProblem = button.parent();
		var testCases = button.parent().find(".testCases");
		var index = thisProblem.index() + 1;
		testCaseNumbers[index]++;
		caseCount = testCaseNumbers[index];
		resultCount++;
		testCases.append("" +
			"<div class='testCase'>"+
				"<span>Test Case " + caseCount + ": </span>"+
				"<span>String: </span><input type='text' name='testString'>"+
				"<input type='radio' name='result" + resultCount + "' value='true' checked> <span>Accept</span>"+
				"<input type='radio' name='result" + resultCount + "' value='false'> <span>Reject</span>"+
				"<br>"+
			"</div>");
	}
		
	$("#getjson").click(generatejson);
	$("#addExercise").click(addProblem);
	$("#addTestCase").click(addCase);
}(jQuery));

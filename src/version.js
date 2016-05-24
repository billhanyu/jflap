/**
* Version support
* Depends on core.js
*/
(function() {
  if (typeof JSAV === "undefined") { return; }
  var theVERSION = "v1.0.1-15-g79fca79";

  JSAV.version = function() {
    return theVERSION;
  };
})();

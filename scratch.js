const testParse = (str) => {
  try {
    JSON.parse(str);
  } catch (e) {
    const match = e.message.match(/position (\d+)/);
    if (match) {
      console.log("Position:", match[1], "in string:", str);
    } else {
      console.log("No position found:", e.message);
    }
  }
}

testParse('{"a": 1, \n "b"}');
testParse('{"hello": "world"');
testParse('{\n  "test": 123,\n  "bad": \n}');

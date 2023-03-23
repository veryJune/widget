function calculate() {
  var input1 = parseFloat(document.getElementById("input1").value);
  var input2 = parseFloat(document.getElementById("input2").value);
  var input3 = parseFloat(document.getElementById("input3").value);
  var input4 = parseFloat(document.getElementById("input4").value);
  var output = document.getElementById("output");

  var inputCount = 0;
  if (!isNaN(input1)) inputCount++;
  if (!isNaN(input2)) inputCount++;
  if (!isNaN(input3)) inputCount++;
  if (!isNaN(input4)) inputCount++;

  if (inputCount < 3) {
    output.textContent = "Please enter at least 3 values.";
    return;
  }

  if (inputCount == 4 && input1 / input2 !== input3 / input4) {
    output.textContent = "Inputs are not in the same ratio.";
    return;
  }

  if (isNaN(input1)) {
    input1 = input2 * input3 / input4;
    document.getElementById("input1").value = input1;
  } else if (isNaN(input2)) {
    input2 = input1 * input4 / input3;
    document.getElementById("input2").value = input2;
  } else if (isNaN(input3)) {
    input3 = input1 * input4 / input2;
    document.getElementById("input3").value = input3;
  } else if (isNaN(input4)) {
    input4 = input2 * input3 / input1;
    document.getElementById("input4").value = input4;
  }

  if (input1 / input2 === input3 / input4) {
    output.textContent = input1 + ":" + input2 + " = " + input3 + ":" + input4;
  } else {
    output.textContent = "Inputs are not in the same ratio.";
  }
}

function reset() {
  document.getElementById("input1").value = "";
  document.getElementById("input2").value = "";
  document.getElementById("input3").value = "";
  document.getElementById("input4").value = "";
  document.getElementById("output").innerHTML = '<h5 style="color:#50597b; font-weight: normal;">* middle click to empty the input value</h5>';
}

function setPreset1() {
  document.getElementById("input1").value = "4";
  document.getElementById("input2").value = "3";
}

function setPreset2() {
  document.getElementById("input1").value = "3";
  document.getElementById("input2").value = "2";
}

function setPreset3() {
  document.getElementById("input1").value = "16";
  document.getElementById("input2").value = "9";
}

function setPreset4() {
  document.getElementById("input1").value = "1.85";
  document.getElementById("input2").value = "1";
}

function setPreset5() {
  document.getElementById("input1").value = "2.35";
  document.getElementById("input2").value = "1";
}

const inputs = document.querySelectorAll("input");

inputs.forEach(function (input) {
  input.addEventListener("auxclick", function (event) {
    if (event.button === 1) { // middle-click event
      input.value = ""; // set input value to empty string
    }
  });
});

document.getElementById("calculate-btn").addEventListener("click", calculate);
document.getElementById("reset-btn").addEventListener("click", reset);
// Add event listener to the preset button
document.getElementById("preset-btn1").addEventListener("click", setPreset1);
document.getElementById("preset-btn2").addEventListener("click", setPreset2);
document.getElementById("preset-btn3").addEventListener("click", setPreset3);
document.getElementById("preset-btn4").addEventListener("click", setPreset4);
document.getElementById("preset-btn5").addEventListener("click", setPreset5);


document.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    calculate();
  }
});

// Recover any cached state to prevent users from losing work
const savedCode = localStorage.getItem("locally_saved_code");

// create a reference to a future worker that will contain an instance of Skulpt
// we offload this to a worker so that we can terminate the process with the stop button
let worker = null;

// get an easy-to-use reference to the output div
const output = document.getElementById("output");

// helper function to add text to the output window
function appendText(text) {
    output.appendChild(document.createTextNode(text));
    output.scrollTop = output.scrollHeight;
}

// Initialize CodeMirror Textarea replacement and load any saved code
const codeMirrorConfig = {
    lineNumbers: true,
    mode: "python",
    theme: "dracula",
    indentUnit: 2,
    tabSize: 2,
    indentWithTabs: false,
    lineWrapping: false,
    styleActiveLine: true,
    extraKeys: {
        Tab: function(cm) {
            if (cm.somethingSelected()) {
                cm.indentSelection("add");
            } else {
                cm.replaceSelection("  ", "end");
            }
        },
        "Shift-Tab": function(cm) {
            cm.indentSelection("subtract");
        }
    }
}

const editor = CodeMirror.fromTextArea(document.getElementById("editor"), codeMirrorConfig);

if (savedCode) {
    editor.setValue(savedCode);
}


// Handle Skulpt instance in an async worker thread to allow for easy disposal
// and prevent infinute loops from hanging the browser
document.getElementById('run-btn').addEventListener('click', function() {

    output.innerText = '';

    if (worker) {
        worker.terminate();
    }

    worker = new Worker('python-worker.js');

    worker.onmessage = function(event) {

        const msg = event.data;

        if (msg.type === "output") {
            appendText(msg.text);
        }

        else if (msg.type === "error") {

            appendText("\n" + msg.text);

            worker.terminate();
            worker = null;
        }

        else if (msg.type === "complete") {
            appendText("\n --- End of Program ---");

            worker.terminate();
            worker = null;
        }

        else if (msg.type === "input_request") {

            appendText(msg.prompt || "");

            const input = document.createElement("input");

            input.type = "text";
            input.className = "console-input";
            output.appendChild(input);
            input.focus();

            input.addEventListener("keydown", function(e) {
                if (e.key === "Enter") {
                    const value = input.value;
                    input.remove();
                    appendText(value + "\n");
                    worker.postMessage({
                        type: "input_response",
                        value: value
                    });
                }
            });

        }
    };

    worker.postMessage({
        type: "run",
        code: editor.getValue()
    });
});


document.getElementById('stop-btn').addEventListener('click', function() {
    if (worker) {
        worker.terminate();
        worker = null;
        appendText("\n\n --- Program stopped. ---");   
    } else {
        appendText("\n\n --- Program is already stopped. ---")
    }
});

document.getElementById("clear-btn").addEventListener("click", function() {
    if (worker === null) {
        output.innerText = "";
    }
});

// Download editor contents to file when clicking download button
document.getElementById('save-btn').addEventListener('click', function() {
    const userCode = editor.getValue();
    const blob = new Blob([userCode], { type: 'text/plain' });
    const link = document.createElement('a');
    link.download = 'my_code.txt';
    link.href = window.URL.createObjectURL(blob);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

document.getElementById('load-btn').addEventListener('click', function() {
    document.getElementById('file-input').click();
});

// save to local storage for each change made
editor.on('change', function() {
    const currentCode = editor.getValue();
    localStorage.setItem("locally_saved_code", currentCode);
});

document.getElementById('file-input').addEventListener('change', function(event) {

    const file = event.target.files[0];

    if (!file) {
        return;
    }

    const reader = new FileReader();

    reader.onload = function(e) {

        const code = e.target.result;

        editor.setValue(code);

        localStorage.setItem(
            "locally_saved_code",
            code
        );
    };

    reader.readAsText(file);
});

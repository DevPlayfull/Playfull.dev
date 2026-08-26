// We are running a maximum of one worker at a time 
// It will have an instance of the Skulpt library for running Python in the browser
// We do this so we can terminate the process at any time
// This also prevents Skulpt from hanging the browser due to a while True etc.

// import the Skultp library files
// this contains the Sk object - an instance of Skulpt
importScripts(
    "lib/skulpt.min.js",
    "lib/skulpt-stdlib.js"
);

// set up our config preferences
const ourSkulptConfig = {
    output: outf,
    read: builtinRead,
    inputfun: customInput,
    inputfunTakesPrompt: true
}   

// helper function for sending output to our main script
// this will be added to the output area
function outf(text) {
    self.postMessage({
        type: "output",
        text: text
    });
}

function builtinRead(x) {
    if (
        Sk.builtinFiles === undefined ||
        Sk.builtinFiles["files"][x] === undefined
    ) {
        throw "File not found: '" + x + "'";
    }

    return Sk.builtinFiles["files"][x];
}

let pendingInputResolve = null;

function customInput(promptText) {

    return new Promise(resolve => {

        pendingInputResolve = resolve;

        self.postMessage({
            type: "input_request",
            prompt: promptText
        });

    });
}

self.onmessage = async function(event) {

    const msg = event.data;

    if (msg.type === "input_response") {

        if (pendingInputResolve) {
            pendingInputResolve(msg.value);
            pendingInputResolve = null;
        }

        return;
    }

    if (msg.type !== "run") {
        return;
    }

    // init code for instance
    const code = msg.code;

    Sk.configure(ourSkulptConfig);

    try {

        await Sk.misceval.asyncToPromise(() =>
            Sk.importMainWithBody("<stdin>", false, code, true)
        );

        self.postMessage({
            type: "complete"
        });

    } catch (err) {

        self.postMessage({
            type: "error",
            text: err.toString()
        });
    }
};
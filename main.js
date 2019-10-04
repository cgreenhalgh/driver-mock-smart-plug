var https = require("https");
var http = require("http");
var express = require("express");
var bodyParser = require("body-parser");
var databox = require("node-databox");
var WebSocket = require("ws");

const DATABOX_ARBITER_ENDPOINT = process.env.DATABOX_ARBITER_ENDPOINT || 'tcp://127.0.0.1:4444';
const DATABOX_ZMQ_ENDPOINT = process.env.DATABOX_ZMQ_ENDPOINT || "tcp://127.0.0.1:5555";
const DATABOX_TESTING = !(process.env.DATABOX_VERSION);
const PORT = process.env.port || '8080';

//server and websocket connection;
let ws, server = null;
//cached ui state
let uimessages = [];

function updateui(msg) {
	// at present only one :-)
	uimessages = [msg];
	if (ws) {
		let json = JSON.stringify(msg)
		try {
			ws.send(json);
		} catch (err) {
			console.log(`error sending ws message`, err)
			try { ws.close(); } catch (err) {}
			ws = null;
		}
	}
}

const store = databox.NewStoreClient(DATABOX_ZMQ_ENDPOINT, DATABOX_ARBITER_ENDPOINT);

//create store schema for plug actuator
const setMetadata = {
	...databox.NewDataSourceMetadata(),
	Description: 'Mock smart plug set power state',
	ContentType: 'application/json',
	Vendor: 'Databox Inc.',
	DataSourceType: 'TP-SetPowerState',
	DataSourceID: 'mock-plug-set',
	StoreType: 'ts/blob',
	IsActuator: true,
}

//now register the actuator
store.RegisterDatasource(setMetadata).then(() => {
	console.log("registered setMetadata")
	return store.TSBlob.Observe(setMetadata.DataSourceID, 0)
}).then((eventEmitter) => {
	console.log(`observing ${setMetadata.DataSourceID}`)
	if (eventEmitter) {
		eventEmitter.on('data', (data) => {
			console.log("[Actuation] data received ", data);
			handleSet(data);
		});
		eventEmitter.on('error', (err) => {
			console.log("[Actuation error]", err);
		});
	}
	// previous messages
	return store.TSBlob.Latest( setMetadata.DataSourceID )
	.then((messages) => {
		if (messages.length>0) {
			handleSet(messages[0]);
		}
	})
	.catch((err) => {
		console.log(`error handling old value`, err);
	})
}).catch((err) => { 
	console.log("error registering datasources", err) 
})

function handleSet(data) {
	console.log(`set`, data);
	let msg = data.data;
	updateui(msg);
}

//set up webserver to serve driver endpoints
const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.set('views', './views');
app.set('view engine', 'ejs');

app.get("/", function (req, res) {
    res.redirect("/ui");
});

app.get("/ui", function (req, res) {
	res.render('index', { testing: DATABOX_TESTING });
});

//when testing, we run as http, (to prevent the need for self-signed certs etc);
if (DATABOX_TESTING) {
    console.log("[Creating TEST http server]", PORT);
    server = http.createServer(app).listen(PORT);
} else {
    console.log("[Creating https server]", PORT);
    const credentials = databox.GetHttpsCredentials();
    server = https.createServer(credentials, app).listen(PORT);
}

//finally, set up websockets
const wss = new WebSocket.Server({ server, path: "/ui/ws" });

wss.on("connection", (_ws) => {
	if (ws) {
		try { ws.close(); } catch (err) {}
		ws = null;
	}
	ws = _ws;
	_ws.on('error', (err) => {
		console.log(`ws error: ${err}`);
		if (ws === _ws) {
			try { _ws.close(); } catch (err) {}
			ws = null;
		}
	});
	console.log("new ws connection -sending state");
	// send cached state
	for (var msg of uimessages) {
		try {
			ws.send(JSON.stringify(msg))
		} catch (err) {
			console.log(`error sending cached ws message`, err);
		}
	}
});

wss.on("error", (err) => {
	console.log("websocket error", err);
	if (ws) {
		ws = null;
	}
})

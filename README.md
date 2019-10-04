# Databox Driver Mock Smart Plug

Dummy/test driver that can be used if you don't have a tplink smart plug
to use with the driver-tplink-smart-plug. Just shows state in the UI.

Status: v1

Todo: 
- multiple plugs?
- other datasources - state and power
- prettier
- support multiple UIs at once

Chris Greenhalgh, The University of Nottinhgam, 2019.

## Data source

Like the [driver-tplink-smart-plug](https://github.com/me-box/driver-tplink-smart-plug)
the actuator to turn the plug on/off has type "TP-SetPowerState".
The data value is a JSON object with one property:
- `data` (string), "on" or "off"

e.g.
```
{ "data": "on" }
```


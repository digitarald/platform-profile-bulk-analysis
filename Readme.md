# Experimental

1. Best practices to record profiles
  - Install [perf-marker](https://github.com/digitarald/perf-marker-webext) extension to add page load and interaction markers
  - Enable dom.event.highrestimestamp.enabled
  - Let pages load completely, then navigate around further or scroll some
2. Put profiles in ./profiles
3. Run `babel-node pages/index.js`

Plans

- Web interface for output
- More reusable tools to slice data

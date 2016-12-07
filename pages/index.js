import fs from 'fs';
import path from 'path';
import _ from 'lodash/fp';
import __ from 'lodash';
import { histogram, thresholdSturges } from 'd3-array';
import prettyjson from 'prettyjson';
import assert from 'assert';
// import Plotly from 'plotly';

import { friendlyMarkers } from './friendly-markers';
import { friendlySymbols, mainSymbols } from './friendly-symbols';

const tmpProfile = './.profiles.json';

const profileNames = [
  // 'shVjrP7H.dms',
  // 'Yk+9DFQm.dms',
  // '_WybY_ZP.dms',
  // 'll4a82Qt.dms',
  // 'AhBR9ArI.dms',
  // 'SfU+aUJ5.dms',
  'DBfoSYhm',
  'ujtRsl1k',
  '40zwvodc',
  'M3Rc1P_M',
  'Z079LGYV',
  'uO8GfvnC',
  'w1Mlf8UY',
  'P_3OufMd',
];

const reduceProfiles = (paths) => {
  const reduced = _.flow([
    _.map(profileName => ({
      profileName,
      data: JSON.parse(fs.readFileSync(path.join(__dirname, '../profiles', profileName))),
    })),
    _.map(({ profileName, data }) => {
      console.time(`Reducing ${profileName}`);
      const profileData = data;
      const profileInterval = profileData.meta.interval;
      const symbolMap = _.flow([
        _.map((symbol) => {
          const match = _.find(category => category.match.test(symbol))(friendlySymbols);
          if (!match) {
            return null;
          }
          return match.name;
        }),
      ])(profileData.symbolicationTable);

      const startTime = _.min([
        _.flow([
          _.map(_.get('samples[0].extraInfo.time')),
          _.min,
        ])(profileData.profileJSON.threads),
      // _.flow([
      //   _.map(_.get('markers[0].time')),
      //   _.min,
      // ])(profileData.profileJSON.threads),
      ]);

      const debugMarker = _.flow([
        _.find({ name: 'Content' }),
        _.get('markers'),
        _.find(({ name }) => name.includes('cleopatra.io')),
      ])(profileData.profileJSON.threads);
      const endTime = debugMarker ? (debugMarker.time - 250) : 0;

      const frames = [];
      const ticks = [];

      const threads = _.flow([
        _.filter(({ name }) => ['Content', 'Compositor'].includes(name)),
        _.map((thread) => {
          const markers = _.flow([
            _.filter(marker => marker.time > startTime && marker.time < endTime),
            _.map((marker) => {
              const result = Object.assign({}, marker);
              const found = _.find(category => category.match.test(marker.name))(friendlyMarkers);
              if (found) {
                if (found.data) {
                  result.data = Object.assign(result.data || {}, found.data);
                }
                const bits = result.name.match(found.match);
                if (bits[1]) {
                  if (bits[1].charAt(0) === '{') {
                    result.meta = JSON.parse(bits[1]);
                    const { timeDelay, url } = result.meta;
                    if (timeDelay && timeDelay < 1000) { // Extension bug
                      result.time -= timeDelay;
                    }
                    if (url) {
                      result.url = url;
                    }
                  } else {
                    result.url = bits[1];
                  }
                }
                result.name = found.name;
                if (found.process) {
                  found.process(result, marker);
                }
                // if (result.name.startsWith('load')) {
                //   console.log(__.round(result.time / 1000, 1), result.name);
                // }
              } else {
                result.name = null;
              }
              result.time -= startTime;
              if (result.time < 0) {
                console.warn('Negative marker start time %d, marker: %j', startTime, marker);
              }
              return result;
            }),
            _.filter('name'),
            _.reduce((result, marker) => {
              if (marker.data && marker.data.interval === 'end') {
                const previous = _.findLast({ name: marker.name })(result);
                if (previous) {
                  previous.duration = Math.max(0, marker.time - previous.time);
                  if (previous.meta) {
                    marker.meta = Object.assign(marker.meta, previous.meta);
                  }
                }
              } else if (!_.isEqual(_.last(result), marker)) {
                result.push(marker);
              }
              return result;
            }, []),
            _.sortBy('time'),
            _.map(marker => Object.assign({
              thread: thread.name,
            }, marker)),
          ])(thread.markers);

          const samples = _.flow([
            _.filter(sample => sample.extraInfo.time < endTime),
            _.map((sample) => {
              const symbol = profileData.symbolicationTable[_.last(sample.frames)];
              const name = _.flow([
                _.map(frame => symbolMap[frame]),
                _.compact,
                _.last,
              ])(sample.frames) || 'unknown';
              const sampleTime = sample.extraInfo.time - startTime;
              // const responsiveness = sample.extraInfo.responsiveness;
              // if (thread.name === 'Content') {
              //   const lastTick = _.last(ticks);
              //   if (!lastTick || lastTick.duration > responsiveness) {
              //     if (lastTick) {
              //       lastTick.duration = sampleTime - lastTick.time - responsiveness;
              //     }
              //     ticks.push({
              //       time: sampleTime - responsiveness,
              //       duration: responsiveness,
              //     });
              //   } if (lastTick) {
              //     lastTick.duration = responsiveness;
              //   }
              // }
              return {
                time: sampleTime,
                symbol,
                duration: profileInterval,
                name,
              };
            }),
            _.reduce((result, current) => {
              const previous = _.last(result);
              if (previous) {
                previous.duration += profileInterval;
              }
              if (previous && current.name === previous.name) {
                return result;
              }
              return result.concat(current);
            }, []),
          ])(thread.samples);

          if (thread.name === 'Compositor') {
            _.flow([
              _.filter({ name: 'composite' }),
              _.forEach((marker) => {
                const previous = _.last(frames);
                const lastVsync = __.findLast(markers, { name: 'vsync' }, markers.indexOf(marker));
                const time = marker.time;
                // const time = lastVsync ? lastVsync.time : marker.time;
                if (previous) {
                  const delta = time - previous.time;
                  if (!delta) {
                    return;
                  }
                  previous.duration = time - previous.time;
                }
                marker.frame = frames.length;
                // lastVsync.frame = frames.length;
                frames.push({
                  index: frames.length,
                  duration: 0,
                  time,
                });
              }),
            ])(markers);
            if (!frames.length) {
              console.warn('Could not identify any frames in %s', profileName);
            }
          }

          return {
            name: thread.name,
            markers,
            samples,
          };
        }),
      ])(profileData.profileJSON.threads);

      const combined = _.flow([
        _.flatMap(thread => thread.markers.concat(thread.samples)),
        _.sortBy('time'),
      ])(threads);

      _.flow([
        _.reduce((lastIdx, entry) => {
          let frameIdx = lastIdx;
          let frame = frames[frameIdx];
          while (entry.time > frame.time + frame.duration && frames[frameIdx + 1]) {
            frameIdx += 1;
            frame = frames[frameIdx];
          }
          if (!frame) {
            console.warn('Frame overflow for %s', profileName);
          }
          entry.frame = frameIdx;
          return frameIdx;
        }, 0),
      ])(combined);

      console.timeEnd(`Reducing ${profileName}`);
      return {
        threads,
        frames,
        name: profileName,
      };
    }),
  ])(paths);
  if (tmpProfile) {
    fs.writeFileSync(tmpProfile, JSON.stringify(reduced));
  }
  return reduced;
};


const profiles = (tmpProfile && fs.existsSync(tmpProfile))
  ? JSON.parse(fs.readFileSync(tmpProfile))
  : reduceProfiles(profileNames);

assert.ok(profiles.length, 'Expected reduced profiles');

const sliceProfileByMarkers = ({ threadName = 'Content', startMarkerFilter, endMarkerFilter }) => {
  return (profile) => {
    const thread = __.find(profile.threads, { name: threadName });
    return _.flow([
      _.filter(startMarkerFilter),
      _.map((startMarker) => {
        const result = {
          sliceTime: startMarker.time,
          sliceDuration: startMarker.duration || 0,
          sliceUrl: startMarker.url,
        };
        if (endMarkerFilter) {
          const end = __.find(
            thread.markers,
            endMarkerFilter,
            thread.markers.indexOf(startMarker),
          );
          if (end) {
            result.sliceDuration = end.time - result.sliceTime;
          } else {
            // console.warn('End marker missign', endMarkerFilter, startMarker);
          }
        }
        return result;
      }),
      _.filter('sliceDuration'),
      _.map((markers) => {
        const slice = Object.assign(markers, profile);
        slice.threads = _.flow([
          _.map((unsliced) => {
            const sliced = Object.assign({}, unsliced);
            _.forEach((entry) => {
              sliced[entry] = _.filter(({ time, duration }) => {
                return time >= slice.sliceTime - 16
                  && time + duration <= slice.sliceTime + slice.sliceDuration + 16;
              })(sliced[entry]);
            })(['markers', 'samples']);
            if (!sliced.markers.length || !sliced.samples.length) {
              assert.ok('Found 0 markers or samples for %j', sliced);
            }
            return sliced;
          }),
        ])(slice.threads);
        return slice;
      }),
    ])(thread.markers);
  };
};

const collectLeavesByFrame = ({ threadName = 'Content', list = 'samples' }) => {
  return (profile) => {
    const thread = __.find(profile.threads, { name: threadName });
    const frames = profile.frames;
    return _.flow([
      _.reduce((collected, entry) => {
        if (!collected[entry.frame]) {
          collected[entry.frame] = {
            $duration: frames[entry.frame].duration,
          };
        }
        const frame = collected[entry.frame];
        if (!frame[entry.name]) {
          frame[entry.name] = 0.0;
        }
        frame[entry.name] += entry.duration;
        return collected;
      }, {}),
      _.values,
      // _.forEach(console.log.bind(console)),
    ])(thread[list]);
  };
};

const collectLeavesByName = ({ threadName = 'Content', list = 'marker', filter = ['tick'], minDuration = 0 }) => {
  return _.flow([
    _.get('threads'),
    _.find({ name: threadName }),
    _.get(list),
    _.filter(leaf => filter.includes(leaf.name)),
    _.filter(leaf => leaf.duration >= minDuration),
  ]);
};

const collectDurations = () => {
  return _.flow([
    _.reduce((result, leave) => {
      const { name, duration } = leave;
      result[name] = result[name] ? (result[name] + duration) : duration;
      return result;
    }, {}),
  ]);
};

const collectCounts = ({ filter = [] }) => {
  return _.flow([
    _.reduce((result, leave) => {
      _.flow([
        _.forEach((name) => {
          if (!leave[name]) {
            return;
          }
          result[name] = result[name] ? (result[name] + leave[name]) : leave[name];
        }),
      ])(filter);
      return result;
    }, {}),
  ]);
};

const normalizeCounts = () => {
  return (counts) => {
    let sum = 0;
    return _.flow([
      _.toPairs,
      _.forEach(([key, value]) => {
        sum += value;
      }),
      _.reduce((ratios, [key, value]) => {
        ratios[key] = value / sum;
        return ratios;
      }, {}),
    ])(counts);
  };
};

const logMarkersArray = () => {
  return _.flow([
    _.map(marker => `${__.round(marker.time, 1)}\t[${marker.name}]\t${
      marker.duration ? `${_.round(marker.duration, 1)}` : ''}`),
    _.join('\n'),
  ]);
};

//
// _.flow([
//   _.map(),
// ])(mainMarkers);

/*
const timeline = _.flow([
  _.map(sample => `${sample.top || sample.symbol}: ${_.round(sample.duration, 1)}`),
  _.join('\n'),
])(samples);
console.log(timeline);

_.flow([
  _.map('name'),
  _.uniq,
  _.forEach((category) => {
    const durations = _.flow([
      _.filter({ top: category }),
      _.map('duration'),
    ])(samples);

    const bins = _.flow([
      _.filter(bin => bin.length > 0),
      _.map(bin => `[${_.round(bin.x0)}-${_.round(bin.x1)}] ${bin.length}`),
      _.join(', '),
    ])(defaultHistogram(durations));
    if (bins.length) {
      // console.log(category, bins);
    }
  }),
])(friendlySymbols);
*/

const durationHistogram = () => {
  const defaultHistogram = histogram()
    .domain([0, 50])
    .thresholds(10);

  return _.flow([
    _.groupBy('name'),
    _.mapValues(_.map(_.get('duration'))),
    _.mapValues((durations) => {
      const histogramScale = defaultHistogram.thresholds(thresholdSturges(durations));
      return histogramScale(durations);
    }),
  ]);
};

const prettifyHistogram = () => {
  return _.flow([
    // _.filter(bin => bin.length > 0),
    _.map(bin => [`${_.round(bin.x0)}-${_.round(bin.x1)}`, bin.length]),
  ]);
};

const logTitle = title => (result) => {
  console.log(`\n${title}`);
  return result;
};

const logCounts = (title) => {
  return _.flow([
    _.toPairs,
    _.sortBy(0),
    _.forEach(([name, count]) => {
      console.log(`${name}\t${__.round(count, 2)}`);
    }),
    _.fromPairs,
  ]);
};

const breakdownSamplesBetweenMarkers = (startMarker, endMarker) => {
  return _.flow([
    _.map(sliceProfileByMarkers({
      threadName: 'Content',
      startMarkerFilter: { name: startMarker },
      endMarkerFilter: { name: endMarker },
    })),
    _.flatten,
    _.map(collectLeavesByName({ filter: mainSymbols, list: 'samples' })),
    _.flatten,
    logTitle(`# Breakdown '${startMarker}' to '${endMarker}'`),
    collectDurations(),
    // logTitle('## Durations'),
    logCounts(),
    normalizeCounts(),
    // logTitle('## Ratios'),
    // logCounts(),
  ])(profiles);
};

// # Page Load Analysis

breakdownSamplesBetweenMarkers('load', 'loadPaint');
breakdownSamplesBetweenMarkers('loadPaint', 'loadComplete');
breakdownSamplesBetweenMarkers('loadComplete', 'loadEnd');

// # Scroll Analysis

// ## Overall Share

const samplesPerLoadPaint = _.flow([
  _.map(sliceProfileByMarkers({
    threadName: 'Content',
    startMarkerFilter: { name: 'inputScroll' },
  })),
  _.flatten,
  _.map(collectLeavesByFrame({})),
  _.flatten,
  collectCounts({ filter: mainSymbols }),
  logTitle('# Breakdown scroll'),
  logCounts(),
])(profiles);

/*
Mac OS

paint: 0.3
unknown: 0.13
script: 0.37
style: 0.08
layout: 0.09
gc: 0.03

Windows 7

script: 0.27
paint: 0.46
gc: 0.08
unknown: 0.10
layout: 0.01
style: 0.08
 */


// const traces = _.flow([
//   _.map(([name, bins]) => {
//     return {
//       x: _.map(0)(bins),
//       y: _.map(1)(bins),
//       type: 'bar',
//       name,
//     };
//   }),
// ])(histogramsByName);

//
// const graphOptions = {
//   layout: {
//     barmode: 'group',
//     xaxis: {
//       title: 'Sample length (ms)',
//     },
//     yaxis: {
//       title: 'Count',
//       type: 'log',
//       autorange: true,
//     },
//   },
//   filename: 'profile-scroll-samples-histogram',
//   fileopt: 'overwrite',
// };
//
// const plotly = Plotly('digitarald', 'cUUxThVDZgCGhqxV21XM');
// plotly.plot(traces, graphOptions, (err, result) => {
//   console.log(result.url);
// });

// console.log((
// _.flow([
//   _.mapValues(prettifyHistogram()),
// ])(markerSegments),
// ));

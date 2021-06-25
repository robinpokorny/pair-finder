import _, { map } from 'lodash';
import { files } from '../utils';
import config from '../config';

export const includes = (list, [a, b]) =>
  list.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
export const findCombinations = (arr) =>
  arr.map((v, i) => arr.slice(i + 1).map((w) => [v, w])).flat();

export const arrange2 = (attendees, logs) => {
  const combinations = findCombinations(attendees)
    .filter(
      (i) =>
        !includes(
          logs.map((o) => o.pairs).flat(),
          i.map((v) => v.tag)
        )
    )
    .filter((i) => i[0].team !== i[1].team)
    .map((o) => o.map((v) => v.tag));
  let list = [];
  let tempList = [...combinations];
  let index = 0;
  while (
    list.length < Math.floor(attendees.length / 2) &&
    index < attendees.length - 1
  ) {
    const tempEle = tempList.shift();
    if (tempEle) {
      list.push(tempEle);
      tempList = tempList.filter(
        (i) => !i.includes(tempEle[0]) && !i.includes(tempEle[1])
      );
    } else {
      list = [];
      tempList = [...combinations];
      tempList.splice(0, index++);
    }
  }
  return list;
};

const peopleMet = (list, tag) => {
  const pairsWithTag = list.filter(([a, b]) => a === tag || b === tag).flat();

  return new Set(pairsWithTag);
};

export const arrange = (attendees, logs) => {
  const flatLogs = logs.flatMap(({ pairs }) => pairs);
  const recent = attendees.reduce(
    (map, { tag }) => map.set(tag, peopleMet(flatLogs, tag)),
    new Map()
  );

  const teamNames = [...new Set(attendees.map(({ team }) => team))];

  const teams = teamNames.reduce(
    (map, name) =>
      map.set(
        name,
        new Set(
          attendees.filter(({ team }) => team === name).map(({ tag }) => tag)
        )
      ),
    new Map()
  );

  return attendees.reduce((pairs, { tag, team }) => {
    if (pairs.has(tag)) return pairs;

    const next = attendees.find(
      ({ tag: candidate }) =>
        tag !== candidate &&
        !pairs.has(candidate) &&
        !recent.get(tag).has(candidate) &&
        !teams.get(team).has(candidate)
    );

    if (!next) {
      throw new Error(
        'ERROR: unable to create a valid list, please reduce the log cap or retry'
      );
    }

    return pairs.set(tag, next.tag).set(next.tag, tag);
  }, new Map());
};

export const findPairs = () => {
  const logs = files.loadLogs();
  files.checkChangingLogs(logs);
  const attendees = _.shuffle(files.loadAttendees());

  console.log('Assembling the pair list... ');

  const list = arrange(attendees, logs);

  console.log('\n');
  console.table(list);

  logs.push({
    date: new Date().toLocaleDateString(),
    pairs: [...list],
  });

  if (logs.length > config.LOGS_CAP) {
    logs.shift();
  }

  files.promptToSave(list, logs);
};

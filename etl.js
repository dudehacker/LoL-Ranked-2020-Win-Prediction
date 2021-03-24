db = connect("localhost:27017/lol");

function cleanUndefined(obj) {
  keys = Object.keys(obj);
  var output = {};
  keys.forEach((k) => {
    if (obj[k] == undefined) {
      output[k] = false;
    } else {
      output[k] = obj[k];
    }
  });
  return output;
}

function gameToPlayerStats(game, accountId = null) {
  var outputs = [];
  for (var i = 0; i < 10; i++) {
    p = game.participants[i];
    pi = game.participantIdentities[i];
    if (accountId != null && pi.player.accountId != accountId) {
      continue;
    }
    stats = p.stats;
    time = p.timeline;
    player = {
      gameId: "" + game.gameId,
      gameCreation: "" + game.gameCreation,
      gameDuration: game.gameDuration,
      playerId: pi.player.accountId,
      teamId: p.teamId,
      championId: p.championId,
      win: stats.win,
      kills: stats.kills,
      deaths: stats.deaths,
      assists: stats.assists,
      largestKillingSpree: stats.largestKillingSpree,
      largestMultiKill: stats.largestMultiKill,
      killingSprees: stats.killingSprees,
      longestTimeSpentLiving: stats.longestTimeSpentLiving,
      doubleKills: stats.doubleKills,
      tripleKills: stats.tripleKills,
      quadraKills: stats.quadraKills,
      pentaKills: stats.pentaKills,
      totalDamageDealtToChampions: stats.totalDamageDealtToChampions,
      totalHeal: stats.totalHeal,
      damageDealtToObjectives: stats.damageDealtToObjectives,
      damageDealtToTurrets: stats.damageDealtToTurrets,
      visionScore: stats.visionScore,
      timeCCingOthers: stats.timeCCingOthers,
      totalDamageTaken: stats.totalDamageTaken,
      goldEarned: stats.goldEarned,
      champLevel: stats.champLevel,
      firstBlood: stats.firstBloodKill || stats.firstBloodAssist,
      firstTower: stats.firstTowerKill || stats.firstTowerAssist,
      firstInhibitor: stats.firstInhibitorKill || stats.firstInhibitorAssist,
    };
    outputs.push(cleanUndefined(player));
  }
  return outputs;
}

// post game analysis
// mongo --quiet lol etl.js > games.json
function printAllGames() {
  var games = [];
  db.NA_Games
    .find
    // { gameId: { $in: [3259540359,3419767343]}  }
    ()
    .forEach((game) => {
      games = games.concat(gameToPlayerStats(game));
    });
  printjson(games);
}

function prepPreGames() {
  var games = [];
  var session = db.getMongo().startSession();
  var sessionId = session.getSessionId().id;

  var cursor = db.NA_Games
    .find
    // { gameId: { $in: [3419767343]}  }
    ()
    .noCursorTimeout();

  var refreshTimestamp = new Date(); // take note of time at operation start

  while (cursor.hasNext()) {
    // Check if more than 5 minutes have passed since the last refresh
    if ((new Date() - refreshTimestamp) / 1000 > 300) {
      // print("refreshing session")
      db.adminCommand({ refreshSessions: [sessionId] });
      refreshTimestamp = new Date();
    }

    // process cursor normally
    let game = cursor.next();
    let tmp = [];
    for (var i = 0; i < 10; i++) {
      var id = game.participantIdentities[i].player.accountId;
      var dt = game.gameCreation;
      var playerHistory = multiAgg([3, 5, 10], id, dt);
      if (playerHistory == null) {
        tmp = [];
        break;
      }
      playerHistory.gameId = "" + game.gameId;
      playerHistory.teamId = game.participants[i].teamId;
      playerHistory.win = game.participants[i].stats.win;
      tmp.push(playerHistory);
    }
    games = games.concat(tmp);
  }

  printjson(games);
}

// pre game analysis
// mongo --quiet lol etl.js > history.json
prepPreGames();

function findLastXGamesByPlayer(accountID, max, dt) {
  var games = [];
  cursor = db.NA_Games.find({
    "participantIdentities.player.accountId": accountID,
    gameCreation: { $lt: dt },
  })
    .sort({ gameCreation: -1 })
    .limit(max);
  cursor.forEach((e) => {
    games = games.concat(gameToPlayerStats(e, accountID));
  });
  return games;
}

function avg(array) {
  const sum = array.reduce((a, b) => a + b, 0);
  const avg = sum / array.length || 0;
  return avg;
}

function streaks(array) {
  var count = 0;
  for (var i = array.length - 1; i >= 0; i--) {
    if (array[i] === 1 && count >= 0) {
      count++;
    } else if (array[i] === 0 && count <= 0) {
      count--;
    } else {
      break;
    }
  }
  var win = count > 0 ? count : 0;
  var lose = count < 0 ? count : 0;
  return { win: win, lose: lose };
}

function aggregateGames(games, accountId,freq) {
  var summary = {
    accountId: accountId,
  };

  var agg = [
    "kda",
    "goldPerMin",
    "dmgPerGold",
    "healPerGold",
    "ccPerMin",
    "dmgTurretPerMin",
    "dmgObjPerMin",
    "visionPerMin",
    "champLevelPerMin",
  ];
  var rate = ["firstBlood", "firstTower", "firstInhibitor", "win"];
  var tmp = {};
  var i = 0;
  while (i < games.length) {
    let game = games[i];
    var obj = {};
    // calculate fields
    obj["kda"] = (game.kills + game.assists) / Math.max(game.assists, 1);
    obj["goldPerMin"] = game.goldEarned / (game.gameDuration / 60);
    obj["dmgPerGold"] = game.totalDamageDealtToChampions / game.goldEarned;
    obj["healPerGold"] = game.totalHeal / game.goldEarned;
    obj["ccPerMin"] = game.timeCCingOthers / (game.gameDuration / 60);
    obj["dmgTurretPerMin"] =
      game.damageDealtToTurrets / (game.gameDuration / 60);
    obj["dmgObjPerMin"] =
      game.damageDealtToObjectives / (game.gameDuration / 60);
    obj["visionPerMin"] = game.visionScore / (game.gameDuration / 60);
    obj["champLevelPerMin"] = game.champLevel / (game.gameDuration / 60);
    obj["firstBlood"] = game.firstBlood ? 1 : 0;
    obj["firstTower"] = game.firstTower ? 1 : 0;
    obj["firstInhibitor"] = game.firstInhibitor ? 1 : 0;
    obj["win"] = game.win ? 1 : 0;

    // save to array
    let j = 0,
      len = agg.length;
    while (j < len) {
      let key = agg[j];
      if (!tmp[key]) {
        tmp[key] = [];
      }
      tmp[key].push(obj[key]);
      j++;
    }

    j = 0;
    len = rate.length;
    while (j < len) {
      let key = rate[j];
      if (!tmp[key]) {
        tmp[key] = [];
      }
      tmp[key].push(obj[key]);
      j++;
    }

    i++;
  }

  // printjson(tmp)
  var i = 0;
  while (i < rate.length) {
    let key = rate[i];
    summary[key + "_rate_" + freq] = avg(tmp[key]);
    i++;
  }

  i=0
  while (i < agg.length){
    let key = agg[i]
    summary[key + "_max_" + freq] = Math.max(...tmp[key]);
    summary[key + "_min_" + freq] = Math.min(...tmp[key]);
    summary[key + "_avg_" + freq] = avg(tmp[key]);
    i++
  }

  var s = streaks(tmp["win"]);
  summary["winStreak_" + freq] = s["win"];
  summary["loseStreak_" + freq] = s["lose"];
  return summary;
}

const accountId = "uj_ccxJL_VHl4iz_FjamN9wGZPqApA9i0aiNl8Sr-fXKRss";
const creationTime = 1589234529043;

// printjson(findLastXGamesByPlayer(accountId,10,creationTime))

function multiAgg(freq, player, dt) {
  var output = {};
  for (var i = 0; i < freq.length; i++) {
    var games = findLastXGamesByPlayer(player, freq[i], dt);
    if (games.length === 0) {
      return null;
    }
    // printjson(games)
    var summary = aggregateGames(games, player,freq[i]);
    // printjson(summary)
    output = Object.assign(output, summary);
  }

  return output;
}

// printjson(multiAgg([3,5,10],accountId,creationTime))

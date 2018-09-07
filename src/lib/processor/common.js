import ENUM from "../constants/enum";
import Utils from "../utils";

import roleStore from "../store/role_store";
import placeStore from "../store/place_store";
import gameStore from "../store/game_store";
import logStore from "../store/log_store";
import nightActionStore from "../store/night_action_store";
import dayActionStore from "../store/day_action_store";
import SkillProcessor from "./skill";

const CommonProcessor = {
  judgeGameForKilling: function() {
    const killer = gameStore.killer;
    if (roleStore.roles.filter(role => role === killer).length === 0) {
      if (roleStore.count === 0) {
        logStore.addLog("游戏结束：所有人死亡，导演胜利。", 1);
      } else {
        logStore.addLog("游戏结束：凶手死亡，受困者胜利。", 1);
      }
      return true;
    }
    if (roleStore.count <= 2) {
      logStore.addLog("游戏结束：受困者存活数过少，凶手胜利。", 1);
      return true;
    }
    if (gameStore.finalDay === gameStore.day + 1 && !gameStore.someoneKilled) {
      logStore.addLog("游戏结束：凶手未能犯下任何杀人案，受困者胜利。", 1);
      return true;
    }
    return false;
  },

  judgeGameForVoting: function(votedName) {
    const killer = gameStore.killer;
    const votedRole = roleStore.getRole(votedName);
    if (votedRole !== null) {
      roleStore.killRole(votedRole);
      logStore.addLog(`游戏结束：${votedRole.title}被公决，${votedRole === killer ? "受困者" : "凶手"}胜利。`);
      return true;
    } else if (gameStore.finalDay === gameStore.day) {
      logStore.addLog(`游戏结束：最终之日无人被公决，凶手胜利。`);
      return true;
    }
    return false;
  },

  actMove: function(role, place, costMovement) {
    if (role.movement < 0) return false; // 警察<警戒>中
    let cost = costMovement;
    if (SkillProcessor.judgeRoleHasSkill(role, ENUM.SKILL.STUDENT_NIGHTMARE) && !dayActionStore.nightmare.moved &&
        (place.name === dayActionStore.nightmare.place.name || role.location.name === dayActionStore.nightmare.place.name)) { // 一次额外移动
      cost = false;
      dayActionStore.nightmare.moved = true;
    }
    if (cost) {
      if (role.movement < 1) { // 移动次数不足
        return false;
      }
      role.movement--;
    }

    if (role.location.name === place.name) {
      return false;
    }

    if (!SkillProcessor.judgeRoleHasSkill(role, ENUM.SKILL.HIGH_SCHOOL_STUDENT_DEXTEROUS)) { // 地形或技能效果限制，<灵巧>技能除外
      if (place.locked || role.location.locked) { // 目标地点或起始地点被锁住
        return false;
      }
      if (place.roles.length >= place.capacity) { // 目标地点已达人数上限，回到大厅
        place = placeStore.getPlace(ENUM.PLACE.LIVING_ROOM);
      }
    }

    // 执行移动
    placeStore.removeRoleFromPlace(role.location, role);
    placeStore.addRoleToPlace(place, role);
    placeStore.shufflePlaceRoles(); // 每次移动后所有地点洗牌
    role.location = place;
    return true;
  },

  getNormalFeedback: function(place) {
    if (place.bodies.length === 0) return [];
    const result = place.bodies.slice();
    result.push(place.method.title);
    if (place.clew) result.push(place.clew.title);
    return result;
  },

  getFoolFeedback: function(place) {
    if (place.bodies.length === 0) return [];
    const result = place.bodies.slice();
    result.push(place.trickMethod.title);
    if (place.trickClew) result.push(place.trickClew.title);
    return result;
  },

  canGetExtra: function(place, role, roleMoved) {
    if (place.extraClews.length === 0) return false;
    if (role.inference) return true; // 在场推理
    if (roleMoved && role.keen) return true; // 敏锐移动
    if (role === gameStore.killer && gameStore.killerSacrificing) return true; // 在场献祭
    return false;
  },

  discoverPlaceOnDay: function(place, roleMoved) {
    const normalFeedbacks = this.getNormalFeedback(place);
    const foolFeedbacks = this.getFoolFeedback(place);
    const extraFeedbacks = place.extraClews.slice();

    const intactCrimeInformation = !gameStore.killerTrackActive &&
      place.bodies.length > 0 && place.clew !== null && place.method !== null;

    let extraClewDiscovered = false;
    let detectiveDiscovered = false;

    let roleList = place.roles; // 天亮发现线索时，由该地点所有人物共同获得
    if (roleMoved) {
      roleList = [roleMoved]; // 移动阶段发现线索时，仅由发动移动者获得一次
    }

    roleList.forEach(role => {
      let feedbacks = role.fool ^ dayActionStore.trickReversed ? foolFeedbacks : normalFeedbacks;

      if (intactCrimeInformation && SkillProcessor.judgeRoleHasSkill(role, ENUM.SKILL.MISTERIOUS_MAN_EXPERT_2)) { // 技能<轻车熟路2>
        const infoTypeTitle = role.fool ^ dayActionStore.trickReversed ? "诡计信息" : "犯罪信息";
        logStore.addLog(`${role.title}收到反馈："你收到的是${infoTypeTitle}"`);
      }

      role.killerTrackActivatable = role.killerTrackActivatable || intactCrimeInformation; // 拉警报的允许时间会一直持续到投票之前

      if (this.canGetExtra(place, role, roleMoved)) {
        feedbacks = feedbacks.concat(extraFeedbacks);
        extraClewDiscovered = true;
      }

      feedbacks = Utils.uniqueArray(feedbacks);
      if (feedbacks.length > 0) {
        SkillProcessor.addCriminalInvestFeedback(role, feedbacks); // 技能<刑事侦查>
        logStore.addLog(`${role.title}收到反馈："${feedbacks.join(" ")}"`);
      }

      if (SkillProcessor.judgeRoleHasSkill(role, ENUM.SKILL.DETECTIVE_DETECTIVE)) { // 技能<平凡侦探>
        if (feedbacks.length > 0) {
          detectiveDiscovered = true;
        } else {
          placeStore.clearBackup();
        }
      }
    });

    if (detectiveDiscovered) { // 技能<平凡侦探>
      placeStore.backupInformationOfPlace(place);
    }

    if (roleList.length > 0) {
      //if (clewDiscovered && place.clew) place.extraClews.remove(place.clew.title); // 清除同名额外线索
      const remainInfo = dayActionStore.nightmare.place !== null && place.name === dayActionStore.nightmare.place.name;
      if (!remainInfo) placeStore.clearInformationOfPlace(place, false); // 清除尸体信息
    }
    if (extraClewDiscovered) {
      //if (place.clew && place.extraClews.indexOf(place.clew.title) >= 0) place.clew = null; // 清除同名线索
      place.extraClews.clear(); // 清除额外线索
    }
  },

  actDayMove: function(role, place, costMovement) { // 白天移动函数
    if (CommonProcessor.actMove(role, place, costMovement)) {
      CommonProcessor.discoverPlaceOnDay(role.location, role); // 移动后判断是否能收到线索
    }
  },

  actNightMove: function(role, place) { // 夜晚移动函数
    if (CommonProcessor.actMove(role, place, false)) {
      if (place.extraClews.length > 0 && role.keen) { // 夜晚移动后仅判定敏锐收线索
        logStore.addLog(`${role.title}收到反馈："${place.extraClews.join(" ")}"`);
        place.extraClews.clear();
      }
    }
  },

  discoverPlacesAtDawn: function() {
    placeStore.places.forEach(place => {
      this.discoverPlaceOnDay(place, null);
      place.locked = false;
    });
    gameStore.setKillerSacrificing(false);

    placeStore.shufflePlaceRoles(); // 天亮后所有地点洗牌
    if (nightActionStore.killerTrack) {
      logStore.addLog("昨天晚上有人发现了凶手行踪。");
    }
  },

  activeKillerTrack: function(role) {
    logStore.addLog(`${role.title}要求公告："发现凶案！"`);
    gameStore.killerTrackActive = true; // 激活凶手行踪
    roleStore.clearKillerTrackActivatable();
  },

  randomMove: function() {
    const roles = roleStore.roles;
    const places = placeStore.places;
    roles.forEach(role => {
      const dst = Utils.randElement(places);
      console.log("random move", role.title, role.location.title, dst.title);
      this.actDayMove(role, dst, true);
      dayActionStore.setMovementOfRole(role, role.location);
    })
  }
};

export default CommonProcessor;

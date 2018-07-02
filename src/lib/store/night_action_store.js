import { observable } from "mobx";

class NightActionStore {
  @observable targetType = "role"; // 'role' or 'place'
  @observable targetRole = null;
  @observable targetPlace = null;
  @observable method = null;
  @observable clew = null;
  @observable trickMethod = null;
  @observable trickClew = null;

  setTargetType(_targetType) {
    this.targetType = _targetType;
  }

  setTargetRole(_targetRole) {
    this.targetRole = _targetRole;
  }

  setTargetPlace(_targetPlace) {
    this.targetPlace = _targetPlace;
  }

  setMethod(_method) {
    this.method = _method;
  }

  setClew(_clew) {
    this.clew = _clew;
  }

  setTrickMethod(_trickMethod) {
    this.trickMethod = _trickMethod;
  }

  setTrickClew(_trickClew) {
    this.trickClew = _trickClew;
  }

  renew() {
    this.targetType = "role";
    this.targetRole = this.targetPlace = this.method = this.clew = this.trickMethod = this.trickClew = null;
  }
}

const nightActionStore = new NightActionStore();
export default nightActionStore;
import { observable, computed } from "mobx";

class RoleStore {
  @observable roles = [];
  @observable deadRoles = [];

  @computed get count() {
    return this.roles.length;
  }

  addRole(initRole) {
    const role = Object.assign({
      movement: 1,
      location: null,
      fool: false
    }, initRole);
    this.roles.push(role);
  }

  killRole(role) {
    this.deadRoles.push(role);
    this.roles.remove(role);
  }
}

const roleStore = new RoleStore();
export default roleStore;

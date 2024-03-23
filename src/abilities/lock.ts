import { CharacteristicValue } from 'homebridge';
import { CharacteristicValue as ShelliesCharacteristicValue, Switch } from 'shellies-ng';

import { Ability, ServiceClass } from './base';

export class LockAbility extends Ability {
  private autoLockMillis: number;
  private timeoutHandle: any = null;

  /**
   * @param component - The switch component to control.
   */
  constructor(readonly component: Switch, autoLockMillis: number = -1) {
    super(
      `Door lock ${component.id + 1}`,
      `lock-${component.id}`,
    );

    this.autoLockMillis = autoLockMillis;
  }

  protected get serviceClass(): ServiceClass {
    return this.Service.LockMechanism;
  }

  protected initialize() {
    // set the initial value
    this.service.setCharacteristic(
      this.Characteristic.LockCurrentState,
      this.component.output ? this.Characteristic.LockCurrentState.UNSECURED : this.Characteristic.LockCurrentState.SECURED,
    );

    // listen for commands from HomeKit
    this.service.getCharacteristic(this.Characteristic.LockTargetState)
      .onSet(this.onSetHandler.bind(this));

    // listen for updates from the device
    this.component.on('change:output', this.outputChangeHandler, this);
  }

  detach() {
    this.component.off('change:output', this.outputChangeHandler, this);
  }

  /**
   * Handles changes to the Switch.On characteristic.
   */
  protected async onSetHandler(value: CharacteristicValue) {
    if (value === this.component.output) {
      return;
    }

    try {
      await this.component.set(value === this.Characteristic.LockTargetState.UNSECURED);

      // Automatic re-lock
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
      if (typeof this.autoLockMillis === 'number' && this.autoLockMillis >= 0)
      {
        if (value === this.Characteristic.LockTargetState.UNSECURED)
        {
          this.timeoutHandle = setTimeout(() => {
            this.service
              .getCharacteristic(this.Characteristic.LockTargetState)
              .setValue(this.Characteristic.LockTargetState.SECURED)
          }, this.autoLockMillis);
        }
      }
    } catch (e) {
      this.log.error(
        'Failed to set switch:',
        e instanceof Error ? e.message : e,
      );
      throw this.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE;
    }
  }

  /**
   * Handles changes to the `output` property.
   */
  protected outputChangeHandler(value: ShelliesCharacteristicValue) {
    this.service.getCharacteristic(this.Characteristic.LockCurrentState)
      .updateValue(value ? this.Characteristic.LockCurrentState.UNSECURED : this.Characteristic.LockCurrentState.SECURED);
    this.service.getCharacteristic(this.Characteristic.LockTargetState)
      .updateValue(value ? this.Characteristic.LockTargetState.UNSECURED : this.Characteristic.LockTargetState.SECURED);
  }
}

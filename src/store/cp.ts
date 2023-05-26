// Utilities
import { defineStore } from 'pinia';
import { v4 as uuid } from 'uuid';

export interface Message {
  date: string;
  direction: string;
  message: Array<any>;
}

export interface Confirmation {
  status: string;
  data: string;
}

export interface StartTransactionConfirmationData {
  parentIdTag: string;
  status: string;
}

export interface StartTransactionConfirmation {
  idTagInfo: StartTransactionConfirmationData;
  transactionId: number;
}

export interface StopTransactionConfirmation {
  idTagInfo: StatusData;
}

export interface RemoteStartTransactionRequest {
  connectorId: number;
  idTag: string;
}

export interface RemoteStopTransactionRequest {
  transactionId: number;
}

export interface DataTransferAction {
  vendorId: string;
  messageId: string;
  data: string;
}

export interface AuthConfirmationActionData {
  parentIdTag: string;
  status: string;
}

export interface AuthConfirmationAction {
  idTagInfo: AuthConfirmationActionData;
}

export interface StartCardRegModeData {
  userId: string;
}

export interface StatusData {
  status: string;
}

export interface ReasonData {
  reason: string;
}

export interface ProfileData {
  affiliationName: string;
  wholeChargedEnergy: number;
  wholeChargedPrice: number;
  unitPrice: number;
  discountedRate: number;
  deposit: number;
}

export const useCpStore = defineStore('cp', {
  state: () => ({
    cpId: '00000000000',
    serverIp: '3.37.138.206',
    serverPort: 8887,
    power: false,
    connector: [
      {
        connected: false,
        status: '',
        transactionId: 0,
        startTimestamp: undefined as Date | undefined,
        stopTimestamp: undefined as Date | undefined,
        chargeAmount: 0,
        chargeFee: 0,
        unitPrice: 0,
        meterValueIntervalId: undefined as NodeJS.Timer | undefined,
        meterValueSentTime: -1
      },
      {
        connected: false,
        status: '',
        transactionId: 0,
        startTimestamp: undefined as Date | undefined,
        stopTimestamp: undefined as Date | undefined,
        chargeAmount: 0,
        chargeFee: 0,
        unitPrice: 0,
        meterValueIntervalId: undefined as NodeJS.Timer | undefined,
        meterValueSentTime: -1
      }
    ],
    websocket: null as WebSocket | null,
    heartbeatInterval: undefined as NodeJS.Timer | undefined,
    messages: [] as Array<Message>,
    userId: '',
    idTag: '0000000000000000',
    status: '',
    profile: {} as ProfileData,
    meterStart: 0
  }),
  // persist: true,
  persist: {
    storage: localStorage,
    paths: [
      'cpId',
      'serverIp',
      'serverPort',
      'idTag',
      'meterStart'
    ],
  },
  actions: {
    togglePower() {
      this.power = !this.power;
      if (this.power) {
        this.websocket = new WebSocket(`ws://${this.serverIp}:${this.serverPort}/${this.cpId}`, [
          'ocpp1.6',
          'ocpp1.5'
        ]);
        this.websocket.onopen = this.onOpen;
        this.websocket.onclose = this.onClose;
        this.websocket.onmessage = this.onMessage;
        this.websocket.onerror = this.onError;
      } else {
        this.websocket?.close(3001);
      }
    },
    onError(event: Event) {
      alert(`Server connect ${event.type}`);
      this.power = false;
    },
    toggleConnector(connectorId: number) {
      this.connector[connectorId].connected = !this.connector[connectorId].connected;
      if (this.connector[connectorId].connected) {
        this.connector[0].status = 'Preparing';
        this.connector[connectorId].status = 'Preparing';
        this.status = 'Preparing';
        this.sendStatusNotification(connectorId);
      } else {
        if (this.connector[connectorId].status === 'Charging') {
          this.stopCharging(this.connector[1].transactionId, true);
        } else {
          this.connector[0].status = 'Available';
          this.connector[connectorId].status = 'Available';
          this.status = 'Available';
          this.sendStatusNotification(connectorId);
        }
      }
      // this.sendStatusNotification(connectorId);
    },
    setCp(id: string, ip: string, port: number) {
      this.cpId = id;
      this.serverIp = ip;
      this.serverPort = port;
    },
    setIdTag(idTag: string) {
      this.idTag = idTag;
    },
    clearMessages() {
      this.messages = [];
    },
    onOpen() {
      this.connector.forEach((e) => (e.status = 'Available'));
      this.status = 'Available';

      setTimeout(this.sendBootNotification, 1000);
      setTimeout(() => {
        this.sendStatusNotification(0);
      }, 2000);
      setTimeout(() => {
        this.sendStatusNotification(1);
      }, 2500);

      this.heartbeatInterval = setInterval(this.sendHeartbeat, 120000);
    },
    onClose() {
      clearInterval(this.heartbeatInterval);

      this.connector.forEach((e) => (e.status = ''));
      this.status = '';
    },
    onMessage(event: MessageEvent<any>) {
      const message = JSON.parse(event.data);
      this.messages.unshift({
        date: this.now(),
        direction: 'recv',
        message: message
      });

      if (message[0] === 2) {
        if (message[2] === 'DataTransfer') {
          this.processDataTransfer(message);
        } else if (message[2] === 'RemoteStartTransaction') {
          const action: RemoteStartTransactionRequest = message[3];
          if (this.connector[action.connectorId].status === 'Preparing') {
            this.sendAccepted(message[1]);
            this.startCharging();
          } else {
            this.sendRejected(message[1]);
          }
        } else if (message[2] === 'RemoteStopTransaction') {
          const action: RemoteStopTransactionRequest = message[3];
          if (this.connector[1].transactionId === action.transactionId) {
            this.sendAccepted(message[1]);
            this.stopCharging(action.transactionId, false);
          } else {
            this.sendRejected(message[1]);
          }
        }
      } else if (message[0] === 3) {
        if (this.status === 'StartCardRegMode') {
          const action: Confirmation = message[2];
          const data: StatusData = JSON.parse(action.data);

          if (data.status === 'Accepted') {
            this.connector[0].status = 'Tagging';
            this.status = 'CardRegMode';
          }
        } else if (this.status === 'CardRegMode') {
          const action: Confirmation = message[2];
          const data: ReasonData = JSON.parse(action.data);

          this.connector[0].status = data.reason;
          setTimeout(() => {
            this.connector[0].status = this.connector[1].status;
            this.status = this.connector[1].status;
          }, 3000);
        } else if (this.status === 'Auth') {
          const action: AuthConfirmationAction = message[2];
          this.connector[0].status = action.idTagInfo.status;

          if (action.idTagInfo.status === 'Accepted') {
            this.getIdTagProfile();
          } else {
            setTimeout(() => {
              this.connector[0].status = this.connector[1].status;
              this.status = this.connector[1].status;
            }, 3000);
          }
        } else if (this.status === 'GetProfile') {
          const action: Confirmation = message[2];
          const data: ProfileData = JSON.parse(action.data);
          this.profile = { ...data };

          this.connector[1].unitPrice = data.unitPrice;
          // this.connector[1].unitPrice = 2.1;
          this.startTransaction();
        } else if (this.status === 'StartTransaction') {
          const action: StartTransactionConfirmation = message[2];

          if (action.idTagInfo.status === 'Accepted') {
            // Start Charging
            this.connector[1].transactionId = action.transactionId;
            this.connector[0].status = 'Charging';
            this.connector[1].status = 'Charging';
            this.connector[1].startTimestamp = new Date();
            this.connector[1].chargeAmount = 0;
            this.connector[1].chargeFee = 0;
            this.status = 'Charging';
            this.sendStatusNotification(1);

            // MeterValues
            this.connector[1].meterValueIntervalId = setInterval(() => {
              const now = new Date();
              const minutes = now.getMinutes();

              this.connector[1].stopTimestamp = new Date();
              this.connector[1].chargeAmount = this.calculateChargeAmount(
                this.connector[1].startTimestamp as Date,
                this.connector[1].stopTimestamp as Date
              );
              this.connector[1].chargeFee =
                (this.connector[1].chargeAmount * this.connector[1].unitPrice) / 1000;

              if (minutes % 15 === 0 && minutes !== this.connector[1].meterValueSentTime) {
                this.connector[1].meterValueSentTime = minutes;
                this.processMeterValues();
              }
            }, 1000);
          }
        } else if (this.status === 'StopTransaction') {
          const action: StopTransactionConfirmation = message[2];
          if (action.idTagInfo.status === 'Accepted') {
            this.stopTransactionSubInfo(this.connector[1].transactionId);
          }
        } else if (this.status === 'StopTransactionSubInfo') {
          this.connector[1].transactionId = 0;

          this.connector[0].status = 'Finishing';
          this.connector[1].status = 'Finishing';
          this.status = 'Finishing';
          this.sendStatusNotification(1);

          setTimeout(() => {
            if (this.connector[1].connected) {
              this.connector[0].status = 'Preparing';
              this.connector[1].status = 'Preparing';
              this.status = 'Preparing';
            } else {
              this.connector[0].status = 'Available';
              this.connector[1].status = 'Available';
              this.status = 'Available';
            }
            this.sendStatusNotification(1);
          }, 5000);
        }
      }
    },
    startTransaction() {
      this.status = 'StartTransaction';

      const message = [
        2,
        this.uuid(),
        'StartTransaction',
        {
          connectorId: 1,
          idTag: this.idTag,
          meterStart: this.meterStart,
          reservationId: 0,
          timestamp: this.timestamp()
        }
      ];

      this.sendMessage(message);
    },
    processMeterValues() {
      const message = [
        2,
        this.uuid(),
        'MeterValues',
        {
          connectorId: 1,
          meterValue: [
            {
              sampledValue: [
                {
                  format: 'Raw',
                  measurand: 'Energy.Active.Import.Register',
                  unit: 'Wh',
                  value: Math.round(this.connector[1].chargeAmount).toString()
                },
                {
                  format: 'Raw',
                  measurand: 'Current.Import',
                  unit: 'A',
                  value: '282'
                }
              ],
              timestamp: this.timestamp()
            }
          ],
          transactionId: this.connector[1].transactionId
        }
      ];

      this.sendMessage(message);
    },
    calculateChargeAmount(start: Date, stop: Date) {
      return ((stop.getTime() - start.getTime()) / 1000) * 1.718;
    },
    stopTransaction(transactionId: number, isLocal: boolean) {
      this.status = 'StopTransaction';

      this.connector[1].stopTimestamp = new Date();
      this.connector[1].chargeAmount = this.calculateChargeAmount(
        this.connector[1].startTimestamp as Date,
        this.connector[1].stopTimestamp as Date
      );
      this.connector[1].chargeFee =
        (this.connector[1].chargeAmount * this.connector[1].unitPrice) / 1000;

      const message = [
        2,
        this.uuid(),
        'StopTransaction',
        {
          idTag: this.idTag,
          meterStop: this.meterStart + Math.round(this.connector[1].chargeAmount),
          reason: isLocal ? 'Local' : 'Remote',
          timestamp: this.timestamp(),
          transactionData: [
            {
              sampledValue: [
                {
                  format: 'Raw',
                  measurand: 'Energy.Active.Import.Register',
                  unit: 'W',
                  value: Math.round(this.connector[1].chargeAmount)
                },
                {
                  format: 'Raw',
                  measurand: 'Energy.Active.Import.Register',
                  unit: 'W',
                  value: 282
                }
              ],
              timestamp: this.timestamp()
            }
          ],
          transactionId: transactionId
        }
      ];

      this.meterStart = this.meterStart + Math.round(this.connector[1].chargeAmount);

      this.sendMessage(message);
    },
    stopTransactionSubInfo(transactionId: number) {
      this.status = 'StopTransactionSubInfo';

      const data = {
        connectorId: 1,
        idTag: this.idTag,
        currency: 'KRW',
        sessionEnergy: Math.round(this.connector[1].chargeAmount),
        sessionFee: Number(this.connector[1].chargeFee.toFixed(2)),
        timestamp: this.timestamp(),
        transactionId: transactionId,
        stopReason: 'CHG_ST_USER_BT'
      };

      const dataTransfer = {
        vendorId: 'SKSIGNET',
        messageId: 'stopTransactionSubInfo.req',
        data: JSON.stringify(data)
      };

      const message = [2, this.uuid(), 'DataTransfer', dataTransfer];
      this.sendMessage(message);
    },
    getIdTagProfile() {
      const data = {
        idTag: this.idTag
      };

      const dataTransfer = {
        vendorId: 'SKSIGNET',
        messageId: 'getIdTagProfile.req',
        data: JSON.stringify(data)
      };

      const message = [2, this.uuid(), 'DataTransfer', dataTransfer];

      this.status = 'GetProfile';
      this.sendMessage(message);
    },
    processDataTransfer(message: Array<any>) {
      const dataTransfer: DataTransferAction = message[3];

      if (dataTransfer.messageId === 'StartCardRegMode') {
        // Start Card Registration
        this.startCardRegMode(message, dataTransfer);
      } else if (dataTransfer.messageId === 'StopCardRegMode') {
        this.connector[0].status = this.connector[1].status;
        this.sendAccepted(message[1]);
      }
    },
    startCardRegMode(message: Array<any>, dataTransfer: DataTransferAction) {
      const data: StartCardRegModeData = JSON.parse(dataTransfer.data);
      this.userId = data.userId;
      this.sendAccepted(message[1]);

      this.status = 'StartCardRegMode';

      this.sendCardRegStatus();
    },
    sendCardRegStatus() {
      const data = {
        userId: this.userId,
        status: 'CardAuthMode'
      };

      const dataTransfer = {
        vendorId: 'SKSIGNET',
        messageId: 'CardRegStatus',
        data: JSON.stringify(data)
      };

      const message = [2, this.uuid(), 'DataTransfer', dataTransfer];
      this.sendMessage(message);
    },
    tag() {
      if (this.status === 'CardRegMode') {
        this.cardRegistration();
      } else if (this.status === 'Preparing') {
        this.startCharging();
      }
    },
    startCharging() {
      const message = [
        2,
        this.uuid(),
        'Authorize',
        {
          idTag: this.idTag
        }
      ];

      this.status = 'Auth';

      this.sendMessage(message);
    },
    stopCharging(transactionId: number, isLocal: boolean) {
      //
      clearInterval(this.connector[1].meterValueIntervalId);
      this.connector[1].meterValueIntervalId = undefined;
      this.connector[1].meterValueSentTime = -1;
      this.stopTransaction(transactionId, isLocal);
    },
    cardRegistration() {
      const data = {
        idTag: this.idTag,
        userId: this.userId
      };

      const dataTransfer = {
        vendorId: 'SKSIGNET',
        messageId: 'CardReg',
        data: JSON.stringify(data)
      };

      const message = [2, this.uuid(), 'DataTransfer', dataTransfer];
      this.sendMessage(message);
    },
    sendAccepted(id: string) {
      const message = [
        3,
        id,
        {
          status: 'Accepted'
        }
      ];

      this.sendMessage(message);
    },
    sendRejected(id: string) {
      const message = [
        3,
        id,
        {
          status: 'Rejected'
        }
      ];

      this.sendMessage(message);
    },
    uuid() {
      return uuid();
    },
    sendHeartbeat() {
      const message = [2, this.uuid(), 'Heartbeat', {}];

      this.sendMessage(message);
    },
    sendBootNotification() {
      const message = [
        2,
        this.uuid(),
        'BootNotification',
        {
          chargePointVendor: 'SIGNETEV',
          chargePointModel: 'SC11K-F-WT-G2',
          chargePointSerialNumber: '01237468458',
          chargeBoxSerialNumber: this.cpId,
          firmwareVersion: '2.12.13.1',
          iccid: '',
          imsi: '',
          meterType: '',
          meterSerialNumber: ''
        }
      ];

      this.sendMessage(message);
    },
    sendStatusNotification(connectorId: number) {
      const message = [
        2,
        this.uuid(),
        'StatusNotification',
        {
          connectorId: connectorId,
          errorCode: 'NoError',
          info: '',
          status: this.connector[connectorId].status,
          timestamp: this.timestamp(),
          vendorId: 'HNS00000501',
          vendorErrorCode: '',
          ChargeBoxSerialNumber: this.cpId,
          RSRP: 79
        }
      ];

      this.sendMessage(message);
    },
    sendMessage(message: Array<any>) {
      this.websocket?.send(JSON.stringify(message));
      this.messages.unshift({ date: this.now(), direction: 'send', message: message });
    },
    now() {
      const today = new Date();
      today.setHours(today.getHours() + 9);
      return today.toISOString().replace('T', ' ').substring(0, 19);
    },
    timestamp() {
      const timestamp = new Date();
      return timestamp.toISOString();
    }
  }
});

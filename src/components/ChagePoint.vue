<template>
  <v-container class="fill-height cps-container">
    <v-row dense class="fill-height" id="height-reference">
      <v-col cols="4">
        <v-card class="mx-auto" variant="outlined" height="77%">
          <v-card-title>
            <v-row dense>
              <v-col cols="4">
                <v-btn
                  icon="mdi-power"
                  size="x-small"
                  :color="cpStore.power ? 'red' : ''"
                  @click="cpStore.togglePower"
                ></v-btn>
                <v-btn
                  class="ml-2"
                  icon="mdi-information-outline"
                  size="x-small"
                  :disabled="cpStore.power ? true : false"
                  @click="openCpDialog"
                ></v-btn>
              </v-col>
              <v-col cols="8" class="text-right">
                {{ cpStore.cpId }}
              </v-col>
            </v-row>
          </v-card-title>
          <v-card-subtitle class="text-right">
            {{ `${cpStore.serverIp}:${cpStore.serverPort}` }}
          </v-card-subtitle>
          <div class="py-2"></div>
          <v-card-text>
            <v-card class="mx-auto text-center" variant="outlined" height="124">
              <v-card-text>
                <v-row dense>
                  <v-col cols="12">
                    <span class="text-h3">{{ cpStore.connector[0].status }}</span>
                  </v-col>
                  <v-col cols="12">
                    <span class="text-h6" v-if="cpStore.connector[0].status === 'Charging'">{{
                      `${(cpStore.connector[1].chargeAmount / 1000).toFixed(
                        3
                      )} kWh   ${cpStore.connector[1].chargeFee.toFixed(3)} Won`
                    }}</span>
                  </v-col>
                </v-row>
              </v-card-text>
            </v-card>
            <div class="py-7"></div>
            <v-row dense>
              <v-col cols="6">
                <v-card class="mx-auto text-center" variant="outlined" :disabled="!cpStore.power">
                  <v-card-title>1</v-card-title>
                  <v-card-text>
                    <v-btn
                      icon="mdi-power-socket-fr"
                      size="x-large"
                      :color="cpStore.connector[1].connected ? 'blue' : ''"
                      @click="cpStore.toggleConnector(1)"
                    ></v-btn>
                  </v-card-text>
                </v-card>
              </v-col>
              <v-col cols="6">
                <v-card class="mx-auto text-center" variant="outlined" disabled>
                  <v-card-title>2</v-card-title>
                  <v-card-text>
                    <v-btn icon="mdi-power-socket-fr" size="x-large"></v-btn>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
        <div class="py-1"></div>
        <v-card class="mx-auto" variant="outlined" height="21.7%">
          <v-card-title>
            Card
            <v-btn
              class="ml-2"
              icon="mdi-information-outline"
              size="x-small"
              @click="openIdTagDialog"
            ></v-btn>
          </v-card-title>
          <v-card-text>{{ cpStore.idTag }}</v-card-text>
          <v-card-actions class="text-center">
            <v-btn
              class="w-100"
              variant="outlined"
              color="primary"
              :disabled="
                cpStore.connector[0].status !== 'Tagging' &&
                cpStore.connector[0].status !== 'Preparing'
              "
              @click="cpStore.tag"
              >Tag</v-btn
            >
          </v-card-actions>
        </v-card>
      </v-col>
      <v-col cols="8">
        <v-card class="mx-auto fill-height" variant="outlined" height="100%" max-height="100%">
          <v-card-title>
            Messages
            <v-btn class="ml-auto" size="x-small" @click="cpStore.clearMessages"> Clear </v-btn>
          </v-card-title>
          <v-card-text>
            <v-table fixed-header :height="tableHeight">
              <thead>
                <tr>
                  <th class="text-left">Timestamp</th>
                  <th class="text-left">Direction</th>
                  <th class="text-left">Action</th>
                  <th class="text-left">Payload</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in cpStore.messages" :key="item.date">
                  <td>{{ item.date }}</td>
                  <td>{{ item.direction }}</td>
                  <td>{{ item.message[0] === 2 ? item.message[2] : 'Confirmation' }}</td>
                  <td>{{ item.message }}</td>
                </tr>
              </tbody>
            </v-table>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
  <v-dialog v-model="cpDialog" persistent width="640">
    <v-card>
      <v-card-title>
        <span class="text-h5">Charge Point</span>
      </v-card-title>
      <v-card-text>
        <v-container>
          <v-row>
            <v-col cols="12">
              <v-text-field label="ID" required v-model="cp.id"></v-text-field>
            </v-col>
            <v-col cols="12">
              <v-text-field label="Server IP" required v-model="cp.ip"></v-text-field>
            </v-col>
            <v-col cols="12">
              <v-text-field label="Server Port" required v-model="cp.port"></v-text-field>
            </v-col>
          </v-row>
        </v-container>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="blue-darken-1" variant="text" @click="cpDialog = false"> Close </v-btn>
        <v-btn color="blue-darken-1" variant="text" @click="saveCpDialog"> Save </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
  <v-dialog v-model="idTagDialog" persistent width="640">
    <v-card>
      <v-card-title>
        <span class="text-h5">Charge Point</span>
      </v-card-title>
      <v-card-text>
        <v-container>
          <v-row>
            <v-col cols="12">
              <v-text-field label="idTag" required v-model="idTag"></v-text-field>
            </v-col>
          </v-row>
        </v-container>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="blue-darken-1" variant="text" @click="idTagDialog = false"> Close </v-btn>
        <v-btn color="blue-darken-1" variant="text" @click="saveIdTagDialog"> Save </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { useCpStore } from '@/store/cp';

export default defineComponent({
  setup() {
    const cpStore = useCpStore();
    return { cpStore };
  },
  data() {
    return {
      cpDialog: false,
      cp: {
        id: '',
        ip: '',
        port: 0
      },
      idTagDialog: false,
      idTag: '',
      tableHeight: 500
    };
  },
  computed: {},
  updated() {
    const element = document.getElementById('height-reference');
    if (element != null && element.clientHeight != undefined) {
      this.tableHeight = element.clientHeight - 80;
    }
  },
  methods: {
    openCpDialog() {
      this.cp.id = this.cpStore.cpId;
      this.cp.ip = this.cpStore.serverIp;
      this.cp.port = this.cpStore.serverPort;

      this.cpDialog = true;
    },
    saveCpDialog() {
      this.cpStore.setCp(this.cp.id, this.cp.ip, this.cp.port);
      this.cpDialog = false;
    },
    openIdTagDialog() {
      this.idTag = this.cpStore.idTag;

      this.idTagDialog = true;
    },
    saveIdTagDialog() {
      this.cpStore.setIdTag(this.idTag);
      this.idTagDialog = false;
    }
  }
});
</script>

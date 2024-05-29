const { kafkaListeners } = require("./data/kafka");

const { useKafkaListener } = require("./functions/kafka");

async function useListeners(endpointMapper, auth, map) {
  const listeners = [
    ...(kafkaListeners?.map((item) => ({ ...item, listenerType: "kafka" })) ||
      []),
  ].sort((a, b) => a.position - b.position);

  for (const item of listeners) {
    try {
      switch (item.listenerType) {
        case "api":
          await useKafkaListener(item, auth, endpointMapper, map);
          break;
        case "kafka":
          await useKafkaListener(item, auth, endpointMapper, map);
          break;
        default:
          break;
      }
    } catch (error) {
      console.log(`Error using listener ${item.listenerType}: ${error}`);

      // if (item.on_error) {
      //   function executeScript(obj) {
      //     return eval?.(`"use strict";(${obj})`);
      //   }
      //   executeScript(item.on_error);
      // }
    }
  }
}

module.exports = { useListeners };

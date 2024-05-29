const { notifications } = require("../../data/notifications");
const { formatAuth } = require("../../../utils/formatAuth");
const { formatURL } = require("../../../utils/formatURL");
const { getCacheInfo } = require("../../../utils/getCacheInfo");
let api;
try {
  api = require("@opentelemetry/api");
} catch (err) {}

function verifyAllowedRequests(allowedRequests, method, path) {
  const results = allowedRequests?.map(
    (item) => item.method === method && item.path === path
  );

  return results?.some((item) => item === true);
}

async function fetchNotification(ctx, type, caches, verifyTracing, scimData) {
  const port = ctx.request.header.host.split(":")[1];

  const results = await Promise.all(
    notifications
      .filter(
        (request) =>
          port === request.port &&
          request.type === type &&
          verifyAllowedRequests(
            request.allowed_requests,
            ctx.request.method,
            ctx.request.url.split("/")[1].toLowerCase()
          )
      )
      .map(async (request) => {
        const hasScimData = scimData && scimData.length;
        let formattedBody = hasScimData ? scimData[0] : ctx.request.body;

        if (ctx.request.url.split("/").length > 2) {
          formattedBody.userName =
            formattedBody?.userName || ctx.request.url.split("/").at(-1);
        }

        try {
          let newSpan = verifyTracing(
            ctx,
            `fetch notification - ${request.type}`
          );

          let formattedURL = formatURL(
            ctx.request.body,
            request.useURL
              ? `${request.url}${ctx.request.url}`
              : `${request.url}`
          );

          let formattedAuth = await getCacheInfo(request.auth, caches, port);

          const response = await fetch(formattedURL, {
            method: request.method,
            headers: {
              Authorization: formatAuth(formattedAuth),
              "Content-Type": "application/json",
              ...(getCacheInfo(request.headers, caches, port) || {}),
            },
            body: JSON.stringify({
              info: {
                url: ctx.request.url,
                method: ctx.request.method,
                type: request.type,
                payload: request.payload,
              },
              data: request.payload === "response" ? ctx.body : formattedBody,
            }),
          });
          const activeSpan = api?.trace.getSpan(api?.context.active());
          activeSpan?.addEvent("Adapter: Sending notification");

          if (![200, 201].includes(response.status)) {
            throw new Error(`Request returned status ${response.status}`);
          }
          newSpan?.end();

          return true;
        } catch (error) {
          console.log(error);
          ctx.status = 400;
          ctx.body = {
            schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
            detail:
              item.errorMessage ||
              `Error while running adapter(notification - ${
                request.type
              }) - URL: ${formatURL(
                ctx.request.body,
                `${request.url}${ctx.request.url}`
              )} - error: ${error.message}`,
            status: 400,
          };
          return ctx;
        }
      })
  );

  return results.every((item) => item === true);
}

module.exports = { fetchNotification };

# Daybook Homework Planner

Phone-friendly homework planner. Homework and attached photos are stored in the current browser on the current device.

## Private single-user sign-in

The sign-in is configured by the site owner. There is no sign-up page. Deploy this Node app on a server host, then set these environment secrets in the host dashboard:

- APP_USERNAME: the one username you choose
- APP_PASSWORD: the password you choose (at least 12 characters)
- NODE_ENV: production, so the HTTPS session cookie is marked secure

Never put the username or password in the repository or send them in chat. The site will not allow sign-in until both credentials are set. Sessions expire after seven days and are cleared when the server restarts.

GitHub Pages is static hosting and cannot enforce this server-side login. After the private Node deployment is ready, disable the old GitHub Pages site so the public copy is no longer available. The GitHub repository itself is currently public, so its source code remains visible.

## Run locally

Install Node.js 18 or newer, set APP_USERNAME, APP_PASSWORD, and NODE_ENV=production in the environment, then run npm start.

AI photo naming is optional and requires separate OpenAI API billing. Without OPENAI_API_KEY, take or attach photos and enter titles manually; the planner still works.

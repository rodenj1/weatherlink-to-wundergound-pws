FROM node:current-alpine

# Create app directory
RUN mkdir -p /usr/src/app
RUN mkdir -p /usr/src/app/lib
WORKDIR /usr/src/app


# Bundle app source
COPY index.js /usr/src/app/
COPY sensor_map.json /usr/src/app/
COPY package.json /usr/src/app/
COPY lib/wunderground.js /usr/src/app/lib/
COPY sync_v2.js /usr/src/app/

RUN npm install

EXPOSE 3030/tcp

CMD [ "npm", "start" ]
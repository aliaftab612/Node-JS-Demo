const express = require("express");
const coursesRoute = require("./courses.js");
const app = express();
app.use(express.json());

const courses = [
  { id: 1, name: "aftab" },
  { id: 2, name: "jubi" },
];

coursesRoute(app, courses);

const port = process.env.port || 3000;

app.listen(port, () => {
  console.log(`Listening on port ${port}...`);
});

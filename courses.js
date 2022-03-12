module.exports = function (app, courses) {
  app.get("/api/courses", (req, res) => {
    let temp = "";
    courses.forEach((element) => {
      temp = temp + ` id = ${element.id} , name = ${element.name} <br>`;
    });
    res.send(temp);
  });

  app.get("/api/courses/:id", (req, res) => {
    let ele = courses.find((c) => c.id === Number(req.params.id));
    if (!ele) res.status(404).send("Not Found");
    res.send(` id = ${ele.id} , name = ${ele.name}`);
  });

  app.post("/api/courses", (req, res) => {
    if (!req.body.name) {
      res.status(400).send("Name not found");
    }
    const course = {
      id: courses.length + 1,
      name: req.body.name,
    };
    courses.push(course);
    res.send(course);
  });
};

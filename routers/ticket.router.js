const app = require("express").Router();
const controller = require("../controllers/ticket.controller");

app.get("/", controller.getAllTickets);
app.get("/:id", controller.getTicketById);

module.exports = app;

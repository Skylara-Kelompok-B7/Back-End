const app = require("express").Router();
const checkout = require("./checkout.router");
const order = require("./order.router");
const history = require("./history.router");
const auth = require("./auth.router");
const user = require("./user.router");
const ticket = require('./ticket.router');

app.get("/", (req, res) => {
    res.status(200).json({
        status: true,
        message: "Connected",
        data: null
    });
});

app.use("/", auth);
app.use("/user", user);
app.use("/checkout", checkout);
app.use("/order", order);
app.use("/history", history);
router.use('/ticket', ticket);

module.exports = app;
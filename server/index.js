const express = require('express');
require('dotenv').config();
const cors = require('cors');
// const session = require('express-session');

const app = express();
const IP = process.env.IP;
const BPORT = process.env.PORT;
const FPORT = process.env.FRONTEND_PORT;

const errorHandler = require('./middleware/errorHandler');
const teamMembersRoutes = require('./routes/TeamMemberRoutes');
const teamRoutes = require('./routes/TeamRoutes');
const workRoutes = require('./routes/WorkScheduleRoutes');
const dailyTotalRoutes = require('./routes/DailyTotalRoutes');
const weeklyTotalRoutes = require('./routes/WeeklyTotalRoutes');

const { db } = require('./utils/db');

db().catch((err) => console.error(err));


app.use(
	cors({
		origin: `${IP}:${FPORT}`,
		credentials: true,
	})
);
app.use(express.json());
// app.use(
// 	session({
// 		secret: process.env.SESSION_SECRET,
// 		resave: false,
// 		saveUninitialized: true,
// 		cookie: { secure: false }, // set to true if your using https
// 	})
// );

app.use(errorHandler);

app.use(teamRoutes);
app.use(workRoutes);
app.use(dailyTotalRoutes);
app.use(weeklyTotalRoutes);
app.use(teamMembersRoutes);

app.listen(BPORT, () => {
	console.log(`Server is running on ${IP}:${BPORT}`);
});
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
// const session = require('express-session');
const teamMembersRoutes = require('./routes/TeamMemberRoutes');
const teamRoutes = require('./routes/TeamRoutes');
const workRoutes = require('./routes/WorkScheduleRoutes');
const dailyTotalRoutes = require('./routes/DailyTotalRoutes');
const weeklyTotalRoutes = require('./routes/WeeklyTotalRoutes');

require('dotenv').config();

const app = express();
const BPORT = process.env.BACKEND_PORT;
const FPORT = process.env.FRONTEND_PORT;
const IP = process.env.IP;

mongoose
	.connect(process.env.MONGODB_URL)
	.then(() => console.log('MongoDB connected'))
	.catch((err) => console.error(err));

app.use(
	cors({
		origin: `${IP}:${FPORT}`, // replace with the origin of the client
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

app.use(teamRoutes);
app.use(workRoutes);
app.use(dailyTotalRoutes);
app.use(weeklyTotalRoutes);
app.use(teamMembersRoutes);

app.use((err, req, res, next) => {
	console.error(err.stack);
	res.status(500).json({ error: error.message || 'Internal Server Error' });
});
app.listen(BPORT, () => {
	console.log(`Server is running on ${IP}:${BPORT}`);
});
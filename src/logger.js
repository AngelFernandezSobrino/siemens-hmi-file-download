import * as winston from 'winston'

const LOGS_DIRECTORY = process.env.LOGS_DIRECTORY || 'data';



export default winston.createLogger({
	level: 'info',
	format: winston.format.combine(
		winston.format.timestamp(),
		winston.format.printf(info => {
			const formattedDate = info.timestamp.replace('T', ' ').replace('Z', '');
			return `${formattedDate}|IEEtecSyncApp|${info.level}|${info.message};`;
		})
	),
	transports: [
		new winston.transports.File({ filename: LOGS_DIRECTORY + '/last.log' }),
	],
});
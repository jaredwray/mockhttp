export const fastifyConfig = {
	logger: {
		transport: {
			target: "pino-pretty",
			options: {
				colorize: true,
				translateTime: true,
				ignore: "pid,hostname",
				singleLine: true,
			},
		},
	},
};

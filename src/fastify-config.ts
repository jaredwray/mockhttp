export function getFastifyConfig(logging = true) {
	return {
		logger: logging
			? {
					transport: {
						target: "pino-pretty",
						options: {
							colorize: true,
							translateTime: true,
							ignore: "pid,hostname",
							singleLine: true,
						},
					},
				}
			: false,
	};
}

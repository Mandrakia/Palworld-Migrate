// System and configuration interfaces

export interface Settings {
	savePath: string[];
	metaPath: string;
	server: {
		host: string;
		port: number;
		dev: boolean;
		'allowed-domains'?: string[];
	};
	saveEdit: {
		outputDir: string;
		verbose: boolean;
	};
}

export interface WorldIdMapping {
	originalId: string;
	uniqueId: string;
	pathIndex: number;
	savePath: string;
}

export interface PlayerFileCache {
	[key: string]: any;
}

export interface ServerCache {
	[key: string]: any;
}
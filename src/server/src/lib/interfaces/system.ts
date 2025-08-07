// System and configuration interfaces

export interface ServerSettings {
    directory: string;
    rest_host? : string;
    rest_protocol?: "http" | "https";
    rest_password?: string;
}
export interface Settings {
    worlds: ServerSettings[];
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

export interface PlayerFileCache {
	[key: string]: any;
}

export interface ServerCache {
	[key: string]: any;
}
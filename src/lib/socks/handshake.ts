import type { Connection } from "@/lib/socks/connection";

// 443 split into the two bytes SOCKS expects
const HTTPS_PORT_HIGH_BYTE = 1;
const HTTPS_PORT_LOW_BYTE = 187;

const SOCKS_VERSION = 0x05;
const AUTH_VERSION = 0x01;
const SUCCESS = 0x00;
const METHOD_PASSWORD = 0x02;
const ONE_METHOD = 0x01;
const COMMAND_CONNECT = 0x01;
const RESERVED = 0x00;
const ADDRESS_IPV4 = 0x01;
const ADDRESS_DOMAIN = 0x03;
const ADDRESS_IPV6 = 0x04;
const IPV4_LENGTH = 4;
const IPV6_LENGTH = 16;
const PORT_LENGTH = 2;
const MAX_FIELD_LENGTH = 255;
const REPLY_LENGTH = 2;
const CONNECT_HEADER_LENGTH = 4;
const REPLY_STATUS_INDEX = 1;
const ADDRESS_TYPE_INDEX = 3;
const DOMAIN_LENGTH_SIZE = 1;
const UNKNOWN_ADDRESS_TYPE = 0;

const encoder = new TextEncoder();

interface ProxyCredentials {
	readonly password: string;
	readonly username: string;
}

const lengthPrefixed = (value: string): number[] => {
	const bytes = [...encoder.encode(value)];
	if (bytes.length > MAX_FIELD_LENGTH) {
		throw new Error("SOCKS field is longer than 255 bytes");
	}
	return [bytes.length, ...bytes];
};

const getBoundAddressLength = async (
	connection: Connection,
	addressType: number,
): Promise<number> => {
	if (addressType === ADDRESS_IPV4) {
		return IPV4_LENGTH;
	}
	if (addressType === ADDRESS_IPV6) {
		return IPV6_LENGTH;
	}
	if (addressType === ADDRESS_DOMAIN) {
		const [length = UNKNOWN_ADDRESS_TYPE] = await connection.readExactly(DOMAIN_LENGTH_SIZE);
		return length;
	}
	throw new Error(`SOCKS proxy replied with unknown address type ${addressType}`);
};

const socksHandshake = async (
	connection: Connection,
	proxy: ProxyCredentials,
	hostname: string,
): Promise<void> => {
	await connection.write([SOCKS_VERSION, ONE_METHOD, METHOD_PASSWORD]);
	const [, method] = await connection.readExactly(REPLY_LENGTH);
	if (method !== METHOD_PASSWORD) {
		throw new Error("SOCKS proxy refused username/password authentication");
	}

	await connection.write([
		AUTH_VERSION,
		...lengthPrefixed(proxy.username),
		...lengthPrefixed(proxy.password),
	]);
	const [, authStatus] = await connection.readExactly(REPLY_LENGTH);
	if (authStatus !== SUCCESS) {
		throw new Error("SOCKS proxy rejected the username or password");
	}

	await connection.write([
		SOCKS_VERSION,
		COMMAND_CONNECT,
		RESERVED,
		ADDRESS_DOMAIN,
		...lengthPrefixed(hostname),
		HTTPS_PORT_HIGH_BYTE,
		HTTPS_PORT_LOW_BYTE,
	]);
	const header = await connection.readExactly(CONNECT_HEADER_LENGTH);
	if (header[REPLY_STATUS_INDEX] !== SUCCESS) {
		throw new Error(
			`SOCKS proxy failed to connect to ${hostname} (reply ${header[REPLY_STATUS_INDEX]})`,
		);
	}
	const addressLength = await getBoundAddressLength(
		connection,
		header[ADDRESS_TYPE_INDEX] ?? UNKNOWN_ADDRESS_TYPE,
	);
	await connection.readExactly(addressLength + PORT_LENGTH);
};

export { socksHandshake, type ProxyCredentials };

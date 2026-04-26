/**
 * Fixtures for OracleManagement component
 * Static mock data moved out of render-time component
 */

export interface OracleProvider {
  id: number;
  address: string;
  reliabilityScore: number;
  totalResolutions: number;
  successfulResolutions: number;
  isActive: boolean;
  dataTypes: string[];
}

export interface OracleSubmission {
  id: number;
  providerId: number;
  poolId: number;
  dataValue: string;
  dataType: string;
  confidence: number;
  timestamp: number;
}

export const mockProviders: OracleProvider[] = [
  {
    id: 0,
    address: 'SP1HTBVD3JG9C05J7HBJTHGR0GGW7KX975CN0QKA',
    reliabilityScore: 95,
    totalResolutions: 47,
    successfulResolutions: 45,
    isActive: true,
    dataTypes: ['price', 'volume', 'market-cap']
  },
  {
    id: 1,
    address: 'SP2JXKMSH007NPYAQHKJPQMAQYAD90NQGTVJVQ02B',
    reliabilityScore: 88,
    totalResolutions: 23,
    successfulResolutions: 20,
    isActive: true,
    dataTypes: ['weather', 'temperature', 'precipitation']
  },
  {
    id: 2,
    address: 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9',
    reliabilityScore: 72,
    totalResolutions: 15,
    successfulResolutions: 11,
    isActive: false,
    dataTypes: ['sports', 'scores']
  }
];

export const mockSubmissions: OracleSubmission[] = [
  {
    id: 0,
    providerId: 0,
    poolId: 1,
    dataValue: "98750.50",
    dataType: "price",
    confidence: 95,
    timestamp: Date.now() - 3600000
  },
  {
    id: 1,
    providerId: 1,
    poolId: 2,
    dataValue: "22.5",
    dataType: "temperature",
    confidence: 88,
    timestamp: Date.now() - 7200000
  },
  {
    id: 2,
    providerId: 0,
    poolId: 3,
    dataValue: "1250000000",
    dataType: "volume",
    confidence: 92,
    timestamp: Date.now() - 1800000
  }
];

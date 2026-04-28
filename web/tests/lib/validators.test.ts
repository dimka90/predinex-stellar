import { describe, it, expect } from 'vitest';
import { validateStellarAddress, validateStellarContractAddress } from '../../app/lib/validators';

describe('validateStellarAddress', () => {
  describe('valid addresses', () => {
    it('accepts a valid G-prefixed public key', () => {
      const result = validateStellarAddress('GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('accepts a valid C-prefixed contract address', () => {
      const result = validateStellarAddress('CA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUWDA');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('accepts another valid G-prefixed address', () => {
      const result = validateStellarAddress('GD5DJQBRKECZEZMTYX6V5EHFNMKZ5YGL4ZMYZ2E5XNHYASZQ4EIG4R2B');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('missing or empty input', () => {
    it('rejects an empty string', () => {
      const result = validateStellarAddress('');
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/required/i);
    });

    it('rejects a null input', () => {
      const result = validateStellarAddress(null as any);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/required/i);
    });

    it('rejects an undefined input', () => {
      const result = validateStellarAddress(undefined as any);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/required/i);
    });
  });

  describe('invalid formats', () => {
    it('rejects addresses with wrong prefix', () => {
      const result = validateStellarAddress('SA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ');
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/invalid.*format/i);
    });

    it('rejects addresses that are too short', () => {
      const result = validateStellarAddress('GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJ');
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/invalid.*format/i);
    });

    it('rejects addresses that are too long', () => {
      const result = validateStellarAddress('GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZZ');
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/invalid.*format/i);
    });

    it('rejects addresses with invalid characters', () => {
      const result = validateStellarAddress('GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSG0');
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/invalid.*format/i);
    });

    it('rejects lowercase addresses', () => {
      const result = validateStellarAddress('ga7qynf7sowq3glr2bgmzehxavirza4kvwltjjfc7mgxua74p7ujvsgz');
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/invalid.*format/i);
    });
  });
});

describe('validateStellarContractAddress', () => {
  describe('valid contract addresses', () => {
    it('accepts a valid C-prefixed contract address', () => {
      const result = validateStellarContractAddress('CA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUWDA');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('accepts another valid C-prefixed contract address', () => {
      const result = validateStellarContractAddress('CCV2F3HHPJ5KQWZIQYBXLF3D5XDY4D5MHKXZ4FFLFKSKNIOGOHYRFTMP');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('missing or empty input', () => {
    it('rejects an empty string', () => {
      const result = validateStellarContractAddress('');
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/required/i);
    });

    it('rejects a whitespace-only string', () => {
      const result = validateStellarContractAddress('   ');
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/required/i);
    });
  });

  describe('invalid contract addresses', () => {
    it('rejects G-prefixed public keys', () => {
      const result = validateStellarContractAddress('GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ');
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/invalid.*contract.*address/i);
    });

    it('rejects addresses that are too short', () => {
      const result = validateStellarContractAddress('CA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJ');
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/invalid.*contract.*address/i);
    });

    it('rejects addresses with wrong prefix', () => {
      const result = validateStellarContractAddress('BA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ');
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/invalid.*contract.*address/i);
    });

    it('rejects addresses with invalid characters', () => {
      const result = validateStellarContractAddress('CA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSG0');
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/invalid.*contract.*address/i);
    });
  });
});

import { PackageService } from './package.service';

describe('PackageService', () => {
  let service: PackageService;

  beforeEach(() => {
    service = new PackageService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('init() should resolve without throwing', async () => {
    await expect(service.init()).resolves.toBeUndefined();
  });

  describe('when no package info has been loaded', () => {
    it('should expose an undefined version', () => {
      expect(service.version).toBeUndefined();
    });

    it('should expose an undefined name', () => {
      expect(service.name).toBeUndefined();
    });
  });

  describe('when package info is available', () => {
    const name = "Yo it's flo";
    const version = '1.0.0';

    beforeEach(() => {
      // `_packageInfo` is populated from package.json at runtime; simulate that
      // here to exercise the public getters independently of the file read.
      (service as unknown as { _packageInfo: unknown })._packageInfo = {
        name,
        version,
      };
    });

    it('should return the name from the package info', () => {
      expect(service.name).toEqual(name);
    });

    it('should return the version from the package info', () => {
      expect(service.version).toEqual(version);
    });
  });
});

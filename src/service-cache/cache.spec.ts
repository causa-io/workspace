import { ServiceCache } from './cache.js';
import { ServiceDoesNotMatchCache } from './errors.js';

type MyContext = {
  someConf: string;
};

class MyService {
  value = 1;

  constructor(readonly context: MyContext) {}
}

const MyServiceDup = MyService;

describe('ServiceCache', () => {
  let context: MyContext;
  let cache: ServiceCache<MyContext>;

  beforeEach(() => {
    context = { someConf: '🔧' };
    cache = new ServiceCache(context);
  });

  describe('get', () => {
    it('should instantiate a service that is not cached', () => {
      const actualService = cache.get(MyService);

      expect(actualService).toBeInstanceOf(MyService);
      expect(actualService.context).toBe(context);
      expect(actualService.value).toEqual(1);
    });

    it('should return the existing instance of the service', () => {
      const existingService = cache.get(MyService);
      existingService.value = 2;

      const actualService = cache.get(MyService);

      expect(actualService).toBeInstanceOf(MyService);
      expect(actualService.context).toBe(context);
      expect(actualService.value).toEqual(2);
    });

    it('should throw an error when services with the same name do not match', () => {
      // `MyServiceDup`'s constructor is still called `MyService`.
      cache.get(MyServiceDup);
      class MyService {
        constructor(readonly context: MyContext) {}
      }

      expect(() => cache.get(MyService)).toThrow(ServiceDoesNotMatchCache);
    });
  });
});

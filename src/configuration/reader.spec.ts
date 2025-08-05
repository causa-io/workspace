import {
  CircularTemplateReferenceError,
  ConfigurationValueNotFoundError,
  UnformattedTemplateValueError,
} from './errors.js';
import {
  ConfigurationReader,
  ConfigurationReaderSourceType,
  type RawConfiguration,
} from './reader.js';

type MyConf = {
  setting1: string;
  nested: {
    setting2: string[];
    setting3: string;
    setting4?: string;
  };
};

const TEMPLATE_KEY = '#render';

describe('ConfigurationReader', () => {
  let reader: ConfigurationReader<MyConf>;

  beforeEach(() => {
    reader = new ConfigurationReader<MyConf>(
      [
        {
          sourceType: ConfigurationReaderSourceType.File,
          source: 'some-file.json',
          configuration: {
            setting1: 'first value',
            nested: {
              setting2: ['array value'],
              setting3: 'value for setting3',
            },
          },
        },
      ],
      { templateKey: TEMPLATE_KEY },
    );
  });

  describe('mergedWith', () => {
    it('should merge objects and arrays', () => {
      const newConf: RawConfiguration<MyConf> = {
        sourceType: ConfigurationReaderSourceType.File,
        source: 'new-file.json',
        configuration: {
          setting1: '✨',
          nested: {
            setting2: ['appended value'],
          },
        },
      };

      const actualReader = reader.mergedWith(newConf);

      expect(actualReader.get()).toEqual({
        setting1: '✨',
        nested: {
          setting2: ['array value', 'appended value'],
          setting3: 'value for setting3',
        },
      });
    });
  });

  describe('get', () => {
    it('should return the entire configuration', () => {
      const actualConfiguration = reader.get();

      expect(actualConfiguration).toEqual({
        setting1: 'first value',
        nested: {
          setting2: ['array value'],
          setting3: 'value for setting3',
        },
      });
    });

    it('should return a path in the configuration', () => {
      const actualValue = reader.get('nested.setting3');

      expect(actualValue).toEqual('value for setting3');
    });

    it('should throw an error if the returned value contains an unformatted template', () => {
      const readerWithTemplate = reader.mergedWith({
        sourceType: ConfigurationReaderSourceType.File,
        source: 'template-file.json',
        configuration: {
          setting1: { [TEMPLATE_KEY]: 'some template' } as any,
        },
      });

      expect(() => readerWithTemplate.get('setting1')).toThrow(
        UnformattedTemplateValueError,
      );
    });

    it('should not throw an error when unsafe option is true for full configuration', () => {
      const readerWithTemplate = reader.mergedWith({
        sourceType: ConfigurationReaderSourceType.File,
        source: 'template-file.json',
        configuration: {
          setting1: { [TEMPLATE_KEY]: 'some template' } as any,
        },
      });

      const actualConfiguration = readerWithTemplate.get({ unsafe: true });

      expect(actualConfiguration).toEqual({
        setting1: { [TEMPLATE_KEY]: 'some template' },
        nested: {
          setting2: ['array value'],
          setting3: 'value for setting3',
        },
      });
    });

    it('should not throw an error when unsafe option is true for a path', () => {
      const readerWithTemplate = reader.mergedWith({
        sourceType: ConfigurationReaderSourceType.File,
        source: 'template-file.json',
        configuration: {
          setting1: { [TEMPLATE_KEY]: 'some template' } as any,
        },
      });

      const actualValue = readerWithTemplate.get('setting1', { unsafe: true });

      expect(actualValue).toEqual({ [TEMPLATE_KEY]: 'some template' });
    });
  });

  describe('getOrThrow', () => {
    it('should return a value that exists', () => {
      const actualValue = reader.get('nested.setting2');

      expect(actualValue).toEqual(['array value']);
    });

    it('should throw if the value is not defined', () => {
      expect(() => reader.getOrThrow('nested.setting4')).toThrow(
        ConfigurationValueNotFoundError,
      );
    });
  });

  describe('getAndRender', () => {
    beforeEach(() => {
      reader = reader.mergedWith({
        sourceType: ConfigurationReaderSourceType.File,
        source: 'template-file.json',
        configuration: {
          nested: {
            setting3: { [TEMPLATE_KEY]: "Hello ${ human('bob') }!" } as any,
            setting4: {
              [TEMPLATE_KEY]: "${ configuration('setting1') }",
            } as any,
          },
        },
      });
    });

    it('should return a value that does not need rendering', async () => {
      const actualValue = await reader.getAndRender({}, 'setting1');

      expect(actualValue).toEqual('first value');
    });

    it('should render a value', async () => {
      const actualValue = await reader.getAndRender(
        { human: async (h) => (h === 'bob' ? '👨' : '👩') },
        'nested.setting3',
      );

      expect(actualValue).toEqual('Hello 👨!');
    });

    it('should provide the configuration fetcher by default', async () => {
      const actualValue = await reader.getAndRender({}, 'nested.setting4');

      expect(actualValue).toEqual('first value');
    });

    it('should throw when templates have a circular reference', async () => {
      const badReader = reader.mergedWith({
        sourceType: ConfigurationReaderSourceType.File,
        source: 'template-file.json',
        configuration: {
          setting1: {
            [TEMPLATE_KEY]: "${ configuration('nested.setting4') }",
          } as any,
        },
      });

      const actualPromise = badReader.getAndRender({}, 'nested.setting4');

      await expect(actualPromise).rejects.toThrow(
        CircularTemplateReferenceError,
      );
    });

    it('should passthrough a fetcher error', async () => {
      const actualPromise = reader.getAndRender({
        human: async () => {
          throw new Error('💣');
        },
      });

      await expect(actualPromise).rejects.toThrow('💣');
    });
  });

  describe('getAndRenderOrThrow', () => {
    it('should return a value that exists', async () => {
      const actualValue = await reader.getAndRenderOrThrow(
        {},
        'nested.setting2',
      );

      expect(actualValue).toEqual(['array value']);
    });

    it('should throw if the value is not defined', async () => {
      const actualPromise = reader.getAndRenderOrThrow({}, '❌');

      await expect(actualPromise).rejects.toThrow(
        ConfigurationValueNotFoundError,
      );
    });
  });
});

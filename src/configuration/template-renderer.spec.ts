import { jest } from '@jest/globals';
import { TemplateRenderingError } from './errors.js';
import { AsyncTemplateRenderer } from './template-renderer.js';

const TEMPLATE_KEY = '#render';

describe('AsyncTemplateRenderer', () => {
  let renderer: AsyncTemplateRenderer;

  let dataFetcher1: jest.Mock<(str: string) => Promise<any>>;
  let dataFetcher2: jest.Mock<(str: string) => Promise<any>>;

  beforeEach(() => {
    dataFetcher1 = jest.fn();
    dataFetcher2 = jest.fn();
    renderer = new AsyncTemplateRenderer(TEMPLATE_KEY, {
      fetcher1: dataFetcher1 as any,
      fetcher2: dataFetcher2 as any,
    });
  });

  describe('renderRecursively', () => {
    it('should return a copy of the object with no formatting', async () => {
      const obj = { noRendering: '🙅' };

      const actual = await renderer.render(obj);

      expect(actual).toEqual(obj);
      expect(actual).not.toBe(obj);
    });

    it('should simply return a non-object input', async () => {
      const obj = '❓';

      const actual = await renderer.render(obj);

      expect(actual).toEqual('❓');
    });

    it('should perform rendering in nested objects', async () => {
      dataFetcher1.mockImplementation(async (str) => `prefix-${str}`);
      dataFetcher2.mockImplementation(async () => '🔑');
      const obj = {
        firstRender: {
          [TEMPLATE_KEY]: "${ fetcher1('👋') }-suffix",
        },
        regularValue: '🤷',
        nestedRender: {
          secondRender: {
            [TEMPLATE_KEY]: "${ fetcher1('✨') } ${ fetcher2('🧸') }",
          },
        },
        arrayRender: ['🥇', { [TEMPLATE_KEY]: "${ fetcher1('🥈') }" }, '🥉'],
      };

      const actual = await renderer.render(obj);

      expect(actual).toEqual({
        firstRender: 'prefix-👋-suffix',
        regularValue: '🤷',
        nestedRender: {
          secondRender: 'prefix-✨ 🔑',
        },
        arrayRender: ['🥇', 'prefix-🥈', '🥉'],
      });
      expect(dataFetcher1).toHaveBeenCalledTimes(3);
      expect(dataFetcher2).toHaveBeenCalledTimes(1);
    });

    it('should return an error when a fetcher is not defined', async () => {
      const obj = { [TEMPLATE_KEY]: "${ nope('💥') }" };

      const actualPromise = renderer.render(obj);

      await expect(actualPromise).rejects.toThrow(TemplateRenderingError);
      await expect(actualPromise).rejects.toThrow('nope is not defined');
    });

    it('should passthrough the error from a fetcher', async () => {
      const obj = { [TEMPLATE_KEY]: "${ fetcher1('💣') }" };
      dataFetcher1.mockRejectedValueOnce(new Error('💥'));

      const actualPromise = renderer.render(obj);

      await expect(actualPromise).rejects.toThrow('💥');
    });
  });

  describe('containsRenderingObject', () => {
    it('should return false for a non-object input', () => {
      const nonObj = 12;

      const actualContains = AsyncTemplateRenderer.containsRenderingObject(
        TEMPLATE_KEY,
        nonObj,
      );

      expect(actualContains).toEqual(false);
    });

    it('should return false when the object does not contain the template key', () => {
      const obj = { key1: '😇', key2: { key3: '🔍' } };

      const actualContains = AsyncTemplateRenderer.containsRenderingObject(
        TEMPLATE_KEY,
        obj,
      );

      expect(actualContains).toEqual(false);
    });

    it('should return false when the template key is not the only key in the object', () => {
      const obj = { key1: '😇', [TEMPLATE_KEY]: '❌' };

      const actualContains = AsyncTemplateRenderer.containsRenderingObject(
        TEMPLATE_KEY,
        obj,
      );

      expect(actualContains).toEqual(false);
    });

    it('should return true when the object contains the template key', () => {
      const obj = { [TEMPLATE_KEY]: '🖨️' };

      const actualContains = AsyncTemplateRenderer.containsRenderingObject(
        TEMPLATE_KEY,
        obj,
      );

      expect(actualContains).toEqual(true);
    });

    it('should return true when the object contains the template key in a nested object', () => {
      const obj = { key1: 1234, nested: { [TEMPLATE_KEY]: '🪆️' } };

      const actualContains = AsyncTemplateRenderer.containsRenderingObject(
        TEMPLATE_KEY,
        obj,
      );

      expect(actualContains).toEqual(true);
    });

    it('should return true when the object contains the template key in an array', () => {
      const obj = { key1: 1234, array: ['1️⃣', { [TEMPLATE_KEY]: '️2️⃣' }] };

      const actualContains = AsyncTemplateRenderer.containsRenderingObject(
        TEMPLATE_KEY,
        obj,
      );

      expect(actualContains).toEqual(true);
    });
  });
});

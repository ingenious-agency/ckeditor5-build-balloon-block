/**
 * @license Copyright (c) 2003-2019, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/**
 * @module image/image/imageediting
 */

import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import ImageLoadObserver from './imageloadobserver';

import {
	viewFigureToModel,
	modelToViewAttributeConverter,
	srcsetAttributeConverter
} from './converters';

import { toImageWidget } from './utils';

import CustomMediaInsertCommand from './custommediainsertcommand';

/**
 * The image engine plugin.
 *
 * It registers:
 *
 * * `<image>` as a block element in the document schema, and allows `alt`, `src` and `srcset` attributes.
 * * converters for editing and data pipelines.
 * * `'imageInsert'` command.
 *
 * @extends module:core/plugin~Plugin
 */
export default class CustomMediaEditing extends Plugin {
	/**
	 * @inheritDoc
	 */
	static get pluginName() {
		return 'CustomMediaEditing';
	}

	/**
	 * @inheritDoc
	 */
	init() {
		const editor = this.editor;
		const schema = editor.model.schema;
		const t = editor.t;
		const conversion = editor.conversion;

		// See https://github.com/ckeditor/ckeditor5-image/issues/142.
		editor.editing.view.addObserver(ImageLoadObserver);

		// Configure schema.
		schema.register('custommedia', {
			isObject: true,
			isBlock: true,
			allowWhere: '$block',
			allowAttributes: ['alt', 'src', 'srcset']
		});

		conversion.for('dataDowncast').elementToElement({
			model: 'custommedia',
			view: (modelElement, viewWriter) =>
				createImageViewElement(viewWriter)
		});

		conversion.for('editingDowncast').elementToElement({
			model: 'custommedia',
			view: (modelElement, viewWriter) =>
				toImageWidget(
					createImageViewElement(viewWriter),
					viewWriter,
					t('image widget')
				)
		});

		conversion
			.for('downcast')
			.add(modelToViewAttributeConverter('src'))
			.add(modelToViewAttributeConverter('alt'))
			.add(srcsetAttributeConverter());

		conversion
			.for('upcast')
			.elementToElement({
				view: {
					name: 'oembed',
					attributes: {
						src: true
					}
				},
				model: (viewImage, modelWriter) =>
					modelWriter.createElement('custommedia', {
						src: viewImage.getAttribute('src')
					})
			})
			.attributeToAttribute({
				view: {
					name: 'oembed',
					key: 'alt'
				},
				model: 'alt'
			})
			.attributeToAttribute({
				view: {
					name: 'oembed',
					key: 'srcset'
				},
				model: {
					key: 'srcset',
					value: viewImage => {
						const value = {
							data: viewImage.getAttribute('srcset')
						};

						if (viewImage.hasAttribute('width')) {
							value.width = viewImage.getAttribute('width');
						}

						return value;
					}
				}
			})
			.add(viewFigureToModel());

		// Register imageUpload command.
		editor.commands.add(
			'custommediaInsert',
			new CustomMediaInsertCommand(editor)
		);
	}
}

// Creates a view element representing the image.
//
//		<figure class="image"><img></img></figure>
//
// Note that `alt` and `src` attributes are converted separately, so they are not included.
//
// @private
// @param {module:engine/view/downcastwriter~DowncastWriter} writer
// @returns {module:engine/view/containerelement~ContainerElement}
export function createImageViewElement(writer) {
	const emptyElement = writer.createEmptyElement('oembed');
	const figure = writer.createContainerElement('figure', {
		class: 'custommedia'
	});

	writer.insert(writer.createPositionAt(figure, 0), emptyElement);

	return figure;
}

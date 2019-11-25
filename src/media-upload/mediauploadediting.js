/**
 * @license Copyright (c) 2003-2019, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/**
 * @module image/imageupload/imageuploadediting
 */

import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import FileRepository from '@ckeditor/ckeditor5-upload/src/filerepository';
import Notification from '@ckeditor/ckeditor5-ui/src/notification/notification';
import Clipboard from '@ckeditor/ckeditor5-clipboard/src/clipboard';
import env from '@ckeditor/ckeditor5-utils/src/env';

import MediaUploadCommand from './mediauploadcommand';

/**
 * The editing part of the image upload feature. It registers the `'imageUpload'` command.
 *
 * @extends module:core/plugin~Plugin
 */
export default class MediaUploadEditing extends Plugin {
	/**
	 * @inheritDoc
	 */
	static get requires() {
		return [FileRepository, Notification, Clipboard];
	}

	static get pluginName() {
		return 'MediaUploadEditing';
	}

	/**
	 * @inheritDoc
	 */
	constructor(editor) {
		super(editor);

		editor.config.define('custommedia', {
			upload: {
				types: ['mp4', 'm4v']
			}
		});
	}

	/**
	 * @inheritDoc
	 */
	init() {
		const editor = this.editor;
		const doc = editor.model.document;
		const schema = editor.model.schema;
		const conversion = editor.conversion;
		const fileRepository = editor.plugins.get(FileRepository);

		// Setup schema to allow uploadId and uploadStatus for medias.
		schema.extend('custommedia', {
			allowAttributes: ['uploadId', 'uploadStatus']
		});

		// Register mediaUpload command.
		editor.commands.add('mediaUpload', new MediaUploadCommand(editor));

		// Register upcast converter for uploadId.
		conversion.for('upcast').attributeToAttribute({
			view: {
				name: 'oembed',
				key: 'uploadId'
			},
			model: 'uploadId'
		});

		// Upload placeholder medias that appeared in the model.
		doc.on('change', () => {
			const changes = doc.differ.getChanges({
				includeChangesInGraveyard: true
			});

			for (const entry of changes) {
				if (entry.type == 'insert' && entry.name != '$text') {
					const item = entry.position.nodeAfter;
					const isInGraveyard =
						entry.position.root.rootName == '$graveyard';

					for (const media of getmediasFromChangeItem(editor, item)) {
						// Check if the image element still has upload id.
						const uploadId = media.getAttribute('uploadId');

						if (!uploadId) {
							continue;
						}

						// Check if the image is loaded on this client.
						const loader = fileRepository.loaders.get(uploadId);

						if (!loader) {
							continue;
						}

						if (isInGraveyard) {
							// If the media was inserted to the graveyard - abort the loading process.
							loader.abort();
						} else if (loader.status == 'idle') {
							// If the media was inserted into content and has not been loaded yet, start loading it.
							this._readAndUpload(loader, media);
						}
					}
				}
			}
		});
	}

	/**
	 * Reads and uploads an image.
	 *
	 * The image is read from the disk and as a Base64-encoded string it is set temporarily to
	 * `image[src]`. When the image is successfully uploaded, the temporary data is replaced with the target
	 * image's URL (the URL to the uploaded image on the server).
	 *
	 * @protected
	 * @param {module:upload/filerepository~FileLoader} loader
	 * @param {module:engine/model/element~Element} mediaElement
	 * @returns {Promise}
	 */
	_readAndUpload(loader, mediaElement) {
		const editor = this.editor;
		const model = editor.model;
		const t = editor.locale.t;
		const fileRepository = editor.plugins.get(FileRepository);
		const notification = editor.plugins.get(Notification);

		model.enqueueChange('transparent', writer => {
			writer.setAttribute('uploadStatus', 'reading', mediaElement);
		});

		return loader
			.read()
			.then(() => {
				const promise = loader.upload();

				// Force re–paint in Safari. Without it, the image will display with a wrong size.
				// https://github.com/ckeditor/ckeditor5/issues/1975
				/* istanbul ignore next */
				if (env.isSafari) {
					const viewFigure = editor.editing.mapper.toViewElement(
						mediaElement
					);
					const viewImg = viewFigure.getChild(0);

					editor.editing.view.once('render', () => {
						// Early returns just to be safe. There might be some code ran
						// in between the outer scope and this callback.
						if (!viewImg.parent) {
							return;
						}

						const domFigure = editor.editing.view.domConverter.mapViewToDom(
							viewImg.parent
						);

						if (!domFigure) {
							return;
						}

						const originalDisplay = domFigure.style.display;

						domFigure.style.display = 'none';

						// Make sure this line will never be removed during minification for having "no effect".
						domFigure._ckHack = domFigure.offsetHeight;

						domFigure.style.display = originalDisplay;
					});
				}

				model.enqueueChange('transparent', writer => {
					writer.setAttribute(
						'uploadStatus',
						'uploading',
						mediaElement
					);
				});

				return promise;
			})
			.then(data => {
				model.enqueueChange('transparent', writer => {
					writer.setAttributes(
						{ uploadStatus: 'complete', src: data.default },
						mediaElement
					);
					this._parseAndSetSrcsetAttributeOnmedia(
						data,
						mediaElement,
						writer
					);
				});

				clean();
			})
			.catch(error => {
				// If status is not 'error' nor 'aborted' - throw error because it means that something else went wrong,
				// it might be generic error and it would be real pain to find what is going on.
				if (loader.status !== 'error' && loader.status !== 'aborted') {
					throw error;
				}

				// Might be 'aborted'.
				if (loader.status == 'error' && error) {
					notification.showWarning(error, {
						title: t('Upload failed'),
						namespace: 'upload'
					});
				}

				clean();

				// Permanently remove image from insertion batch.
				model.enqueueChange('transparent', writer => {
					writer.remove(mediaElement);
				});
			});

		function clean() {
			model.enqueueChange('transparent', writer => {
				writer.removeAttribute('uploadId', mediaElement);
				writer.removeAttribute('uploadStatus', mediaElement);
			});

			fileRepository.destroyLoader(loader);
		}
	}

	/**
	 * Creates the `srcset` attribute based on a given file upload response and sets it as an attribute to a specific image element.
	 *
	 * @protected
	 * @param {Object} data Data object from which `srcset` will be created.
	 * @param {module:engine/model/element~Element} image The image element on which the `srcset` attribute will be set.
	 * @param {module:engine/model/writer~Writer} writer
	 */
	_parseAndSetSrcsetAttributeOnmedia(data, media, writer) {
		// Srcset attribute for responsive images support.
		let maxWidth = 0;

		const srcsetAttribute = Object.keys(data)
			// Filter out keys that are not integers.
			.filter(key => {
				const width = parseInt(key, 10);

				if (!isNaN(width)) {
					maxWidth = Math.max(maxWidth, width);

					return true;
				}
			})

			// Convert each key to srcset entry.
			.map(key => `${data[key]} ${key}w`)

			// Join all entries.
			.join(', ');

		if (srcsetAttribute != '') {
			writer.setAttribute(
				'srcset',
				{
					data: srcsetAttribute,
					width: maxWidth
				},
				media
			);
		}
	}
}

// Returns `true` if non-empty `text/html` is included in the data transfer.
//
// @param {module:clipboard/datatransfer~DataTransfer} dataTransfer
// @returns {Boolean}
export function isHtmlIncluded(dataTransfer) {
	return (
		Array.from(dataTransfer.types).includes('text/html') &&
		dataTransfer.getData('text/html') !== ''
	);
}

function getmediasFromChangeItem(editor, item) {
	return Array.from(editor.model.createRangeOn(item))
		.filter(value => value.item.is('media'))
		.map(value => value.item);
}

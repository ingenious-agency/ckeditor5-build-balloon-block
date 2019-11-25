/**
 * @license Copyright (c) 2003-2019, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/**
 * @module image/imageupload/imageuploadui
 */

import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import FileDialogButtonView from '@ckeditor/ckeditor5-upload/src/ui/filedialogbuttonview';
import imageIcon from '@ckeditor/ckeditor5-core/theme/icons/image.svg';

function createMediaTypeRegExp(types) {
	// Sanitize the MIME type name which may include: "+", "-" or ".".
	const regExpSafeNames = types.map(type => type.replace('+', '\\+'));

	return new RegExp(`^video\\/(${regExpSafeNames.join('|')})$`);
}

/**
 * The image upload button plugin.
 *
 * For a detailed overview, check the {@glink features/image-upload/image-upload Image upload feature} documentation.
 *
 * Adds the `'imageUpload'` button to the {@link module:ui/componentfactory~ComponentFactory UI component factory}.
 *
 * @extends module:core/plugin~Plugin
 */
export default class MediaUploadUi extends Plugin {
	/**
	 * @inheritDoc
	 */
	init() {
		const editor = this.editor;
		const t = editor.t;

		// Setup `mediaUpload` button.
		editor.ui.componentFactory.add('mediaUpload', locale => {
			const view = new FileDialogButtonView(locale);
			const command = editor.commands.get('mediaUpload');
			const mediaTypes = editor.config.get('custommedia.upload.types');
			const mediaTypesRegExp = createMediaTypeRegExp(mediaTypes);

			view.set({
				acceptedType: mediaTypes.map(type => `video/${type}`).join(','),
				allowMultipleFiles: false
			});

			view.buttonView.set({
				label: t('Upload and insert video'),
				icon: imageIcon,
				tooltip: true
			});

			view.buttonView.bind('isEnabled').to(command);

			view.on('done', (evt, files) => {
				const mediaToUpload = Array.from(files).filter(file =>
					mediaTypesRegExp.test(file.type)
				);

				if (mediaToUpload.length) {
					editor.execute('mediaUpload', { file: mediaToUpload });
				}
			});

			return view;
		});
	}
}

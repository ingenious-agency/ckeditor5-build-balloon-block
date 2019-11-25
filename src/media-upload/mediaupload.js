import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import MediaUploadUI from './mediauploadui';
import MediaUploadProgress from './mediauploadprogress';
import MediaUploadEditing from './mediauploadediting';

/**
 * The image upload plugin.
 *
 * For a detailed overview, check the {@glink features/image-upload/image-upload image upload feature} documentation.
 *
 * This plugin does not do anything directly, but it loads a set of specific plugins to enable image uploading:
 *
 * * {@link module:image/imageupload/imageuploadediting~ImageUploadEditing},
 * * {@link module:image/imageupload/imageuploadui~ImageUploadUI},
 * * {@link module:image/imageupload/imageuploadprogress~ImageUploadProgress}.
 *
 * @extends module:core/plugin~Plugin
 */
export default class MediaUpload extends Plugin {
	/**
	 * @inheritDoc
	 */
	static get pluginName() {
		return 'MediaUpload';
	}

	/**
	 * @inheritDoc
	 */
	static get requires() {
		return [MediaUploadEditing, MediaUploadUI, MediaUploadProgress];
	}
}

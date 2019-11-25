import FileRepository from '@ckeditor/ckeditor5-upload/src/filerepository';
import Command from '@ckeditor/ckeditor5-core/src/command';

import { findOptimalInsertionPosition } from '@ckeditor/ckeditor5-widget/src/utils';

export default class MediaUploadCommand extends Command {
	/**
	 * @inheritDoc
	 */
	refresh() {
		this.isEnabled = ismediaAllowed(this.editor.model);
	}

	/**
	 * Executes the command.
	 *
	 * @fires execute
	 * @param {Object} options Options for the executed command.
	 * @param {File|Array.<File>} options.file The image file or an array of image files to upload.
	 */
	execute(options) {
		const editor = this.editor;
		const model = editor.model;

		const fileRepository = editor.plugins.get(FileRepository);

		model.change(writer => {
			const filesToUpload = Array.isArray(options.file)
				? options.file
				: [options.file];

			for (const file of filesToUpload) {
				uploadmedia(writer, model, fileRepository, file);
			}
		});
	}
}

function uploadmedia(writer, model, fileRepository, file) {
	const loader = fileRepository.createLoader(file);

	// Do not throw when upload adapter is not set. FileRepository will log an error anyway.
	if (!loader) {
		return;
	}

	insertMedia(writer, model, { uploadId: loader.id });
}

export function insertMedia(writer, model, attributes = {}) {
	const mediaElement = writer.createElement('custommedia', attributes);

	const insertAtSelection = findOptimalInsertionPosition(
		model.document.selection,
		model
	);

	model.insertContent(mediaElement, insertAtSelection);

	// Inserting an image might've failed due to schema regulations.
	if (mediaElement.parent) {
		writer.setSelection(mediaElement, 'on');
	}
}

/**
 * Checks if image can be inserted at current model selection.
 *
 * @param {module:engine/model/model~Model} model
 * @returns {Boolean}
 */
export function ismediaAllowed(model) {
	const schema = model.schema;
	const selection = model.document.selection;

	return (
		ismediaAllowedInParent(selection, schema, model) &&
		!checkSelectionOnObject(selection, schema) &&
		isInOthermedia(selection)
	);
}

// Checks if selection is placed in other image (ie. in caption).
function isInOthermedia(selection) {
	return [...selection.focus.getAncestors()].every(
		ancestor => !ancestor.is('custommedia')
	);
}

// Check if selection is on object.
//
// @returns {Boolean}
function checkSelectionOnObject(selection, schema) {
	const selectedElement = selection.getSelectedElement();

	return selectedElement && schema.isObject(selectedElement);
}

function ismediaAllowedInParent(selection, schema, model) {
	const parent = getInsertmediaParent(selection, model);

	return schema.checkChild(parent, 'custommedia');
}

// Returns a node that will be used to insert image with `model.insertContent` to check if image can be placed there.
function getInsertmediaParent(selection, model) {
	const insertAt = findOptimalInsertionPosition(selection, model);

	const parent = insertAt.parent;

	if (parent.isEmpty && !parent.is('$root')) {
		return parent.parent;
	}

	return parent;
}

/**
 * @license Copyright (c) 2003-2019, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/**
 * @module image/image/utils
 */

import {
	findOptimalInsertionPosition,
	isWidget,
	toWidget
} from '@ckeditor/ckeditor5-widget/src/utils';

/**
 * Converts a given {@link module:engine/view/element~Element} to an image widget:
 * * Adds a {@link module:engine/view/element~Element#_setCustomProperty custom property} allowing to recognize the image widget element.
 * * Calls the {@link module:widget/utils~toWidget} function with the proper element's label creator.
 *
 * @param {module:engine/view/element~Element} viewElement
 * @param {module:engine/view/downcastwriter~DowncastWriter} writer An instance of the view writer.
 * @param {String} label The element's label. It will be concatenated with the image `alt` attribute if one is present.
 * @returns {module:engine/view/element~Element}
 */
export function toImageWidget(viewElement, writer, label) {
	writer.setCustomProperty('custommedia', true, viewElement);

	return toWidget(viewElement, writer, { label: labelCreator });

	function labelCreator() {
		const imgElement = viewElement.getChild(0);
		const altText = imgElement.getAttribute('alt');

		return altText ? `${altText} ${label}` : label;
	}
}

/**
 * Checks if a given view element is an image widget.
 *
 * @param {module:engine/view/element~Element} viewElement
 * @returns {Boolean}
 */
export function isImageWidget(viewElement) {
	return (
		!!viewElement.getCustomProperty('custommedia') && isWidget(viewElement)
	);
}

/**
 * Returns an image widget editing view element if one is selected.
 *
 * @param {module:engine/view/selection~Selection|module:engine/view/documentselection~DocumentSelection} selection
 * @returns {module:engine/view/element~Element|null}
 */
export function getSelectedImageWidget(selection) {
	const viewElement = selection.getSelectedElement();

	if (viewElement && isImageWidget(viewElement)) {
		return viewElement;
	}

	return null;
}

/**
 * Checks if the provided model element is an `image`.
 *
 * @param {module:engine/model/element~Element} modelElement
 * @returns {Boolean}
 */
export function isImage(modelElement) {
	return !!modelElement && modelElement.is('custommedia');
}

/**
 * Handles inserting single file. This method unifies image insertion using {@link module:widget/utils~findOptimalInsertionPosition} method.
 *
 *		model.change( writer => {
 *			insertImage( writer, model, { src: 'path/to/image.jpg' } );
 *		} );
 *
 * @param {module:engine/model/writer~Writer} writer
 * @param {module:engine/model/model~Model} model
 * @param {Object} [attributes={}] Attributes of inserted image
 */
export function insertImage(writer, model, attributes = {}) {
	const imageElement = writer.createElement('custommedia', attributes);

	const insertAtSelection = findOptimalInsertionPosition(
		model.document.selection,
		model
	);

	model.insertContent(imageElement, insertAtSelection);

	// Inserting an image might've failed due to schema regulations.
	if (imageElement.parent) {
		writer.setSelection(imageElement, 'on');
	}
}

/**
 * Checks if image can be inserted at current model selection.
 *
 * @param {module:engine/model/model~Model} model
 * @returns {Boolean}
 */
export function isImageAllowed(model) {
	const schema = model.schema;
	const selection = model.document.selection;

	return (
		isImageAllowedInParent(selection, schema, model) &&
		!checkSelectionOnObject(selection, schema) &&
		isInOtherImage(selection)
	);
}

// Checks if image is allowed by schema in optimal insertion parent.
//
// @returns {Boolean}
function isImageAllowedInParent(selection, schema, model) {
	const parent = getInsertImageParent(selection, model);

	return schema.checkChild(parent, 'custommedia');
}

// Check if selection is on object.
//
// @returns {Boolean}
function checkSelectionOnObject(selection, schema) {
	const selectedElement = selection.getSelectedElement();

	return selectedElement && schema.isObject(selectedElement);
}

// Checks if selection is placed in other image (ie. in caption).
function isInOtherImage(selection) {
	return [...selection.focus.getAncestors()].every(
		ancestor => !ancestor.is('custommedia')
	);
}

// Returns a node that will be used to insert image with `model.insertContent` to check if image can be placed there.
function getInsertImageParent(selection, model) {
	const insertAt = findOptimalInsertionPosition(selection, model);

	const parent = insertAt.parent;

	if (parent.isEmpty && !parent.is('$root')) {
		return parent.parent;
	}

	return parent;
}

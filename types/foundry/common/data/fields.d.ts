import type DataModel from "../abstract/data.d.ts";
import type { EmbeddedCollection } from "../abstract/embedded-collection.d.mts";

/* ---------------------------------------- */
/*  Abstract Data Field                     */
/* ---------------------------------------- */

/**
 * @typedef DataFieldOptions
 * @property [required=false]  Is this field required to be populated?
 * @property [nullable=false]  Can this field have null values?
 * @property [initial]         The initial value of a field, or a function which assigns that initial value.
 * @property [validate]        A data validation function which accepts one argument with the current value.
 * @property [choices]         An array of values or an object of values/labels which represent allowed choices for the
 *                             field. A function may be provided which dynamically returns the array of choices.
 * @property [label]           A localizable label displayed on forms which render this field.
 * @property [hint]            Localizable help text displayed on forms which render this field.
 * @property [validationError] A custom validation error string. When displayed will be prepended with the
 *                             document name, field name, and candidate value.
 */
export interface DataFieldOptions<
    TSourceProp,
    TRequired extends boolean,
    TNullable extends boolean,
    THasInitial extends boolean
> {
    required?: TRequired;
    nullable?: TNullable;
    initial?: THasInitial extends true
        ? TSourceProp | (() => TSourceProp) | null
        : THasInitial extends false
        ? undefined
        : TSourceProp | (() => TSourceProp) | null | undefined;
    validate?: (value: unknown) => boolean | Error | void;
    choices?: readonly TSourceProp[] | Record<string, string> | Function;
    label?: string;
    hint?: string;
    validationError?: string;
}

/**
 * An abstract class that defines the base pattern for a data field within a data schema.
 *
 * @property name             The name of this data field within the schema that contains it
 * @property [required=false] Is this field required to be populated?
 * @property [nullable=false] Can this field have null values?
 * @property initial          The initial value of a field, or a function which assigns that initial value.
 * @property validate         A data validation function which accepts one argument with the current value.
 * @property [readonly=false] Should the prepared value of the field be read-only, preventing it from being
 *                                        changed unless a change to the _source data is applied.
 * @property {string} label               A localizable label displayed on forms which render this field.
 * @property {string} hint                Localizable help text displayed on forms which render this field.
 * @property {string} validationError     A custom validation error string. When displayed will be prepended with the
 *                                        document name, field name, and candidate value.
 */
export abstract class DataField<
    TSourceProp = unknown,
    TModelProp = TSourceProp,
    TRequired extends boolean = boolean,
    TNullable extends boolean = boolean,
    THasInitial extends boolean = boolean
> implements DataFieldOptions<TSourceProp, TRequired, TNullable, THasInitial>
{
    /** @param options Options which configure the behavior of the field */
    constructor(options?: DataFieldOptions<TSourceProp, TRequired, TNullable, THasInitial>);

    /** The initially provided options which configure the data field */
    options: DataFieldOptions<TSourceProp, TRequired, TNullable, THasInitial>;

    /**
     * The field name of this DataField instance.
     * This is assigned by `SchemaField#initialize`.
     * @internal
     */
    name: string;

    /**
     * A reference to the parent schema to which this DataField belongs.
     * This is assigned by `SchemaField#initialize`.
     * @internal
     */
    parent: DataSchema | undefined;

    /** Default parameters for this field type */
    protected static get _defaults(): DataFieldOptions<unknown, boolean, boolean, boolean>;

    /** A dot-separated string representation of the field path within the parent schema. */
    get fieldPath(): string;

    /**
     * Apply a function to this DataField which propagates through recursively to any contained data schema.
     * @param fn           The function to apply
     * @param value        The current value of this field
     * @param [options={}] Additional options passed to the applied function
     * @returns The results object
     */
    apply(
        fn: string | ((field: this, value?: unknown, options?: Record<string, unknown>) => unknown),
        value?: unknown,
        options?: Record<string, unknown>
    ): unknown;

    /* -------------------------------------------- */
    /*  Field Cleaning                              */
    /* -------------------------------------------- */

    /**
     * Coerce source data to ensure that it conforms to the correct data type for the field.
     * Data coercion operations should be simple and synchronous as these are applied whenever a DataModel is constructed.
     * For one-off cleaning of user-provided input the sanitize method should be used.
     * @param value     The initial value
     * @param [options] Additional options for how the field is cleaned
     * @param [options.partial] Whether to perform partial cleaning?
     * @param [options.source]  The root data model being cleaned
     * @returns The cast value
     */
    clean(value: unknown, options?: CleanFieldOptions): MaybeSchemaProp<TSourceProp, TRequired, TNullable, THasInitial>;

    /**
     * Apply any cleaning logic specific to this DataField type.
     * @param value     The appropriately coerced value.
     * @param [options] Additional options for how the field is cleaned.
     * @returns The cleaned value.
     */
    protected _cleanType(
        value?: unknown,
        options?: CleanFieldOptions
    ): MaybeSchemaProp<TSourceProp, TRequired, TNullable, THasInitial>;

    /**
     * Cast a non-default value to ensure it is the correct type for the field
     * @param value The provided non-default value
     * @returns The standardized value
     */
    protected abstract _cast(value?: unknown): unknown;

    /**
     * Attempt to retrieve a valid initial value for the DataField.
     * @param data The source data object for which an initial value is required
     * @returns A valid initial value
     * @throws An error if there is no valid initial value defined
     */
    getInitialValue(data: object): unknown;

    /* -------------------------------------------- */
    /*  Field Validation                            */
    /* -------------------------------------------- */

    /**
     * Validate a candidate input for this field, ensuring it meets the field requirements.
     * A validation failure can be provided as a raised Error (with a string message) or by returning false.
     * A validator which returns true denotes that the result is certainly valid and further validations are unnecessary.
     * @param value The initial value
     * @param [options={}] Options which affect validation behavior
     * @returns Returns a `ModelValidationError` if a validation failure occurred
     */
    validate(value: unknown, options?: Record<string, unknown>): ModelValidationError | void;

    /**
     * Special validation rules which supersede regular field validation.
     * This validator screens for certain values which are otherwise incompatible with this field like null or undefined.
     * @param value The candidate value
     * @returns A boolean to indicate with certainty whether the value is valid.
     *                                Otherwise, return void.
     * @throws May throw a specific error if the value is not valid
     */
    protected _validateSpecial(value: unknown): boolean | void;

    /**
     * A default type-specific validator that can be overridden by child classes
     * @param value The candidate value
     * @param [options={}] Options which affect validation behavior
     * @returns A boolean to indicate with certainty whether the value is valid. Otherwise, return void.
     * @throws May throw a specific error if the value is not valid
     */
    protected _validateType(value: unknown, options?: Record<string, unknown>): boolean | void;

    /* -------------------------------------------- */
    /*  Initialization and Serialization            */
    /* -------------------------------------------- */

    /**
     * Initialize the original source data into a mutable copy for the DataModel instance.
     * @param value     The source value of the field
     * @param model     The DataModel instance that this field belongs to
     * @param [options] Initialization options
     */
    initialize(
        value: unknown,
        model?: ConstructorOf<DataModel>,
        options?: object
    ): MaybeSchemaProp<TModelProp, TRequired, TNullable, THasInitial>;

    /**
     * Export the current value of the field into a serializable object.
     * @param value The initialized value of the field
     * @returns An exported representation of the field
     */
    toObject(value: TModelProp): MaybeSchemaProp<TSourceProp, TRequired, TNullable, THasInitial>;
}

/* -------------------------------------------- */
/*  Data Schema Field                           */
/* -------------------------------------------- */

export type DataSchema = Record<string, DataField<unknown, unknown, boolean>>;

/** A special class of {@link DataField} which defines a data schema. */
export class SchemaField<
    TDataSchema extends DataSchema,
    TSourceProp extends SourceFromSchema<TDataSchema> = SourceFromSchema<TDataSchema>,
    TModelProp = TSourceProp,
    TRequired extends boolean = true,
    TNullable extends boolean = false,
    THasInitial extends boolean = true
> extends DataField<TSourceProp, TModelProp, TRequired, TNullable, THasInitial> {
    /**
     * @param fields  The contained field definitions
     * @param options Options which configure the behavior of the field
     */
    constructor(fields: TDataSchema, options?: DataFieldOptions<TSourceProp, TRequired, TNullable, THasInitial>);

    protected static override get _defaults(): DataFieldOptions<DataSchema, boolean, boolean, boolean>;

    /** The contained field definitions. */
    fields: DataSchema;

    /**
     * Initialize and validate the structure of the provided field definitions.
     * @param fields The provided field definitions
     * @returns The validated schema
     */
    protected _initialize(fields: DataSchema): DataSchema;

    /* -------------------------------------------- */
    /*  Schema Iteration                            */
    /* -------------------------------------------- */

    /** Iterate over a SchemaField by iterating over its fields. */
    [Symbol.iterator](): Generator<DataField<TSourceProp, TRequired, TNullable, THasInitial>>;

    /** An array of field names which are present in the schema. */
    keys(): string[];

    /** An array of DataField instances which are present in the schema. */
    values(): DataField[];

    /** An array of [name, DataField] tuples which define the schema. */
    entries(): [string, DataField][];

    /**
     * Test whether a certain field name belongs to this schema definition.
     * @param fieldName The field name
     * @returns Does the named field exist in this schema?
     */
    has(fieldName: string): boolean;

    /**
     * Get a DataField instance from the schema by name
     * @param fieldName The field name
     * @returns The DataField instance or undefined
     */
    get(fieldName: string): DataField | undefined;

    /* -------------------------------------------- */
    /*  Data Field Methods                          */
    /* -------------------------------------------- */

    protected override _cast(value: unknown): MaybeSchemaProp<TSourceProp, TRequired, TNullable, THasInitial>;

    protected override _cleanType(
        data: object,
        options?: CleanFieldOptions
    ): MaybeSchemaProp<TSourceProp, TRequired, TNullable, THasInitial>;

    override initialize(
        value: TSourceProp,
        model: ConstructorOf<DataModel>
    ): MaybeSchemaProp<TModelProp, TRequired, TNullable, THasInitial>;

    protected override _validateType(data: object, options?: Record<string, unknown>): void;

    override toObject(value: TModelProp): MaybeSchemaProp<TSourceProp, TRequired, TNullable, THasInitial>;

    override apply(
        fn: string | ((field: this, value?: unknown, options?: Record<string, unknown>) => unknown),
        data?: object,
        options?: Record<string, unknown>
    ): unknown;
}

export interface CleanFieldOptions {
    partial?: boolean;
    source?: object;
}

/* -------------------------------------------- */
/*  Basic Field Types                           */
/* -------------------------------------------- */

type BooleanFieldOptions<
    TSourceProp extends boolean,
    TRequired extends boolean,
    TNullable extends boolean,
    THasInitial extends boolean
> = Omit<DataFieldOptions<TSourceProp, TRequired, TNullable, THasInitial>, "choices">;

/** A subclass of [DataField]{@link DataField} which deals with boolean-typed data. */
export class BooleanField<
    TSourceProp extends boolean = boolean,
    TModelProp = TSourceProp,
    TRequired extends boolean = true,
    TNullable extends boolean = false,
    THasInitial extends boolean = true
> extends DataField<TSourceProp, TModelProp, TRequired, TNullable, THasInitial> {
    protected static override get _defaults(): BooleanFieldOptions<boolean, boolean, boolean, boolean>;

    protected override _cast(value: unknown): boolean;

    protected override _validateType(value: unknown): value is boolean;
}

/**
 * @typedef NumberFieldOptions
 * @property [min]            A minimum allowed value
 * @property [max]            A maximum allowed value
 * @property [step]           A permitted step size
 * @property [integer=false]  Must the number be an integer?
 * @property [positive=false] Must the number be positive?
 */
interface NumberFieldOptions<
    TSourceProp extends number,
    TRequired extends boolean,
    TNullable extends boolean,
    THasInitial extends boolean
> extends DataFieldOptions<TSourceProp, TRequired, TNullable, THasInitial> {
    min?: number;
    max?: number;
    step?: number;
    integer?: boolean;
}

/** A subclass of [DataField]{@link DataField} which deals with number-typed data. */
export class NumberField<
        TSourceProp extends number = number,
        TModelProp = TSourceProp,
        TRequired extends boolean = false,
        TNullable extends boolean = true,
        THasInitial extends boolean = true
    >
    extends DataField<TSourceProp, TModelProp, TRequired, TNullable, THasInitial>
    implements NumberFieldOptions<TSourceProp, TRequired, TNullable, THasInitial>
{
    /** @param options  Options which configure the behavior of the field */
    constructor(options?: NumberFieldOptions<TSourceProp, TRequired, TNullable, THasInitial>);

    protected static override get _defaults(): NumberFieldOptions<number, boolean, boolean, boolean>;

    protected override _cast(value: unknown): TSourceProp;

    protected override _cleanType(
        value: unknown,
        options?: CleanFieldOptions
    ): MaybeSchemaProp<TSourceProp, TRequired, TNullable, THasInitial>;

    protected override _validateType(value: unknown): void;
}

interface StringFieldOptions<
    TSourceProp extends string,
    TRequired extends boolean,
    TNullable extends boolean,
    THasInitial extends boolean
> extends DataFieldOptions<TSourceProp, TRequired, TNullable, THasInitial> {
    choices?: readonly TSourceProp[] | Record<TSourceProp, string> | Function;
    /** [blank=true] Is the string allowed to be blank (empty)? */
    blank?: boolean;
    /** [trim=true]  Should any provided string be trimmed as part of cleaning? */
    trim?: boolean;
}

/** A subclass of `DataField` which deals with string-typed data. */
export class StringField<
        TSourceProp extends string,
        TModelProp,
        TRequired extends boolean,
        TNullable extends boolean,
        THasInitial extends boolean
    >
    extends DataField<TSourceProp, TModelProp, TRequired, TNullable, THasInitial>
    implements StringFieldOptions<TSourceProp, TRequired, TNullable, THasInitial>
{
    /** @param options Options which configure the behavior of the field */
    constructor(options?: StringFieldOptions<TSourceProp, TRequired, TNullable, THasInitial>);

    protected static override get _defaults(): StringFieldOptions<string, boolean, boolean, boolean>;

    override clean(
        value: unknown,
        options?: CleanFieldOptions
    ): MaybeSchemaProp<TSourceProp, TRequired, TNullable, THasInitial>;

    protected override _cast(value: unknown): TSourceProp;

    protected override _validateSpecial(value: unknown): boolean | void;

    protected _validateType(value: unknown): boolean | void;
}

type ObjectFieldOptions<
    TSourceProp extends object,
    TRequired extends boolean,
    TNullable extends boolean,
    THasInitial extends boolean
> = DataFieldOptions<TSourceProp, TRequired, TNullable, THasInitial>;

/** A subclass of `DataField` which deals with object-typed data. */
export class ObjectField<
        TSourceProp extends object,
        TModelProp = TSourceProp,
        TRequired extends boolean = true,
        TNullable extends boolean = false,
        THasInitial extends boolean = true
    >
    extends DataField<TSourceProp, TModelProp, TRequired, TNullable, THasInitial>
    implements Omit<ObjectFieldOptions<TSourceProp, TRequired, TNullable, THasInitial>, "initial">
{
    protected static override get _defaults(): ObjectFieldOptions<object, boolean, boolean, boolean>;

    protected override _cast(value: unknown): TSourceProp;

    override initialize(value: unknown): MaybeSchemaProp<TModelProp, TRequired, TNullable, THasInitial>;

    override toObject(value: TModelProp): MaybeSchemaProp<TSourceProp, TRequired, TNullable, THasInitial>;

    protected override _validateType(value: unknown): boolean | void;
}

export type FlagField<
    TSourceProp extends { [K in string]?: Record<string, unknown> } = { [K in string]?: Record<string, unknown> },
    TModelProp = TSourceProp,
    TRequired extends boolean = false,
    TNullable extends boolean = false,
    THasInitial extends boolean = true
> = ObjectField<TSourceProp, TModelProp, TRequired, TNullable, THasInitial>;

type ArrayFieldOptions<
    TSourceProp extends unknown[],
    TRequired extends boolean,
    TNullable extends boolean,
    THasInitial extends boolean
> = DataFieldOptions<TSourceProp, TRequired, TNullable, THasInitial>;

/** A subclass of `DataField` which deals with array-typed data. */
export class ArrayField<
        TElementField extends DataField,
        TSourceProp extends SourcePropFromDataField<TElementField>[] = SourcePropFromDataField<TElementField>[],
        TModelProp extends object = TSourceProp,
        TRequired extends boolean = false,
        TNullable extends boolean = false,
        THasInitial extends boolean = true
    >
    extends DataField<TSourceProp, TModelProp, TRequired, TNullable, THasInitial>
    implements ArrayFieldOptions<TSourceProp, TRequired, TNullable, THasInitial>
{
    /**
     * @param element A DataField instance which defines the type of element contained in the Array.
     * @param options Options which configure the behavior of the field
     */
    constructor(element: TElementField, options?: ArrayFieldOptions<TSourceProp, TRequired, TNullable, THasInitial>);

    /** The data type of each element in this array */
    element: TElementField;

    /**
     * Validate the contained element type of the ArrayField
     * @param element The type of Array element
     * @returns The validated element type
     * @throws An error if the element is not a valid type
     */
    protected static _validateElementType(element: unknown): unknown;

    protected static override get _defaults(): ArrayFieldOptions<unknown[], boolean, boolean, boolean>;

    protected override _cast(value: unknown): TSourceProp;

    protected _cleanType(
        value: unknown[] | Set<unknown>,
        options?: CleanFieldOptions
    ): MaybeSchemaProp<TSourceProp, TRequired, TNullable, THasInitial>;

    protected override _validateType(value: unknown, options?: Record<string, unknown>): void;

    /**
     * Validate every element of the ArrayField
     * @param value   The array to validate
     * @param options Validation options
     * @returns An array of element-specific errors
     */
    protected _validateElements(value: unknown[], options?: Record<string, unknown>): ModelValidationError[];

    override initialize(
        value: TSourceProp,
        model: ConstructorOf<DataModel>,
        options: ArrayFieldOptions<TSourceProp, TRequired, TNullable, THasInitial>
    ): MaybeSchemaProp<TModelProp, TRequired, TNullable, THasInitial>;

    override toObject(value: TModelProp): MaybeSchemaProp<TSourceProp, TRequired, TNullable, THasInitial>;

    override apply(
        fn: string | ((field: this, value?: unknown, options?: Record<string, unknown>) => unknown),
        data?: object,
        options?: Record<string, unknown>
    ): unknown;
}

export interface ArrayField<
    TElementField extends DataField,
    TSourceProp extends SourcePropFromDataField<TElementField>[] = SourcePropFromDataField<TElementField>[],
    TModelProp extends object = TSourceProp,
    TRequired extends boolean = false,
    TNullable extends boolean = false,
    THasInitial extends boolean = true
> extends DataField<TSourceProp, TModelProp, TRequired, TNullable, THasInitial> {
    clean(value: unknown, options?: CleanFieldOptions): MaybeSchemaProp<TSourceProp, TRequired, TNullable, THasInitial>;
}

/**
 * A subclass of `ArrayField` which supports a set of contained elements.
 * Elements in this set are treated as fungible and may be represented in any order or discarded if invalid.
 */
export class SetField<
    TElementField extends DataField,
    TSourceProp extends SourcePropFromDataField<TElementField>[] = SourcePropFromDataField<TElementField>[],
    TModelProp extends Set<SourcePropFromDataField<TElementField>> = Set<SourcePropFromDataField<TElementField>>,
    TRequired extends boolean = false,
    TNullable extends boolean = false,
    THasInitial extends boolean = true
> extends ArrayField<TElementField, TSourceProp, TModelProp, TRequired, TNullable, THasInitial> {
    protected override _validateElements(value: unknown[], options?: Record<string, unknown>): ModelValidationError[];

    override initialize(
        value: TSourceProp,
        model: ConstructorOf<DataModel>
    ): MaybeSchemaProp<TModelProp, TRequired, TNullable, THasInitial>;

    override toObject(value: TModelProp): MaybeSchemaProp<TSourceProp, TRequired, TNullable, THasInitial>;
}

/** A subclass of `SchemaField` which embeds some other DataModel definition as an inner object. */
export class EmbeddedDataField<
    TDataSchema extends DataSchema,
    TSourceProp extends SourceFromSchema<TDataSchema>,
    TModelProp extends DataModel = DataModel,
    TRequired extends boolean = true,
    TNullable extends boolean = false,
    THasInitial extends boolean = true
> extends SchemaField<TDataSchema, TSourceProp, TModelProp, TRequired, TNullable, THasInitial> {
    /**
     * @param model   The class of DataModel which should be embedded in this field
     * @param options Options which configure the behavior of the field
     */
    constructor(model: TModelProp, options: ObjectFieldOptions<TSourceProp, TRequired, TNullable, THasInitial>);

    /** The embedded DataModel definition which is contained in this field. */
    model: ConstructorOf<TModelProp>;

    protected override _initialize(fields: DataSchema): DataSchema;

    override initialize(
        value: TSourceProp,
        model: ConstructorOf<DataModel>
    ): MaybeSchemaProp<TModelProp, TRequired, TNullable, THasInitial>;

    override toObject(value: TModelProp): MaybeSchemaProp<TSourceProp, TRequired, TNullable, THasInitial>;
}

/**
 * A subclass of `ArrayField` which supports an embedded Document collection.
 * Invalid elements will be dropped from the collection during validation rather than failing for the field entirely.
 */
export class EmbeddedCollectionField<
    TDataSchema extends DataSchema,
    TRequired extends boolean = true,
    TNullable extends boolean = false,
    THasInitial extends boolean = true
> extends ArrayField<
    SchemaField<TDataSchema>,
    SourceFromSchema<TDataSchema>[],
    EmbeddedCollection<DataModel>,
    TRequired,
    TNullable,
    THasInitial
> {
    /**
     * @param element The type of Document which belongs to this embedded collection
     * @param options Options which configure the behavior of the field
     */
    constructor(
        element: ConstructorOf<Document>,
        options?: ArrayFieldOptions<SourceFromSchema<TDataSchema>[], TRequired, TNullable, THasInitial>
    );

    static override _validateElementType(element: unknown): Document;

    /** A reference to the DataModel subclass of the embedded document element */
    get model(): ConstructorOf<Document>;

    /** The DataSchema of the contained Document model. */
    get schema(): DataModel["schema"];

    protected override _cleanType(
        value: unknown,
        options?: CleanFieldOptions
    ): MaybeSchemaProp<SourceFromSchema<TDataSchema>[], TRequired, TNullable, THasInitial>;

    protected override _validateElements(value: unknown[], options?: Record<string, unknown>): ModelValidationError[];

    override initialize(_value: unknown, model: ConstructorOf<DataModel>): EmbeddedCollection<DataModel>;

    override toObject(
        value: EmbeddedCollection<DataModel>
    ): MaybeSchemaProp<SourceFromSchema<TDataSchema>[], TRequired, TNullable, THasInitial>;

    override apply(
        fn: string | ((field: this, value?: unknown, options?: Record<string, unknown>) => unknown),
        data?: object,
        options?: Record<string, unknown>
    ): unknown;
}

/* -------------------------------------------- */
/*  Special Field Types                         */
/* -------------------------------------------- */

/**
 * A subclass of [StringField]{@link StringField} which provides the primary _id for a Document.
 * The field may be initially null, but it must be non-null when it is saved to the database.
 */
export class DocumentIdField<
    TModelProp extends string | DataModel = string,
    TRequired extends boolean = true,
    TNullable extends boolean = true,
    THasInitial extends boolean = true
> extends StringField<string, TModelProp, TRequired, TNullable, THasInitial> {
    protected static override get _defaults(): StringFieldOptions<string, boolean, boolean, boolean>;

    protected override _cast(value: unknown): string;

    protected override _validateType(value: unknown): boolean;
}

/**
 * A special class of [StringField]{@link StringField} field which references another DataModel by its id.
 * This field may also be null to indicate that no foreign model is linked.
 */
export class ForeignDocumentField<
    TModelProp extends string | DataModel = DataModel,
    TRequired extends boolean = true,
    TNullable extends boolean = true,
    THasInitial extends boolean = true
> extends DocumentIdField<TModelProp, TRequired, TNullable, THasInitial> {
    /**
     * @param model   The foreign DataModel class definition which this field should link to.
     * @param options Options which configure the behavior of the field
     */
    constructor(
        model: ConstructorOf<DataModel>,
        options?: StringFieldOptions<string, TRequired, TNullable, THasInitial>
    );

    /** A reference to the model class which is stored in this field */
    model: DataModel;

    protected static override get _defaults(): StringFieldOptions<string, boolean, boolean, boolean>;

    _cast(value: unknown): string;

    override initialize(
        value: string,
        model: ConstructorOf<DataModel>
    ): MaybeSchemaProp<TModelProp, TRequired, TNullable, THasInitial>;

    toObject(value: TModelProp): MaybeSchemaProp<string, TRequired, TNullable, THasInitial>;
}

/** A subclass of `ObjectField` which supports a system-level data object. */
export class SystemDataField<TSourceProp extends object = object, TModelProp = TSourceProp> extends ObjectField<
    TSourceProp,
    TModelProp
> {
    /**
     * @param document The base document class which belongs in this field
     * @param options  Options which configure the behavior of the field
     */
    constructor(document: ConstructorOf<DataModel>, options?: ObjectFieldOptions<TSourceProp, true, false, true>);

    /** The canonical document name of the document type which belongs in this field */
    document: ConstructorOf<DataModel>;

    protected static override get _defaults(): ObjectFieldOptions<object, true, false, true>;

    /** A convenience accessor for the name of the document type associated with this SystemDataField */
    get documentName(): string;

    /**
     * Get the DataModel definition that should be used for this type of document.
     * @param type The Document instance type
     * @returns The DataModel class, or null
     */
    getModelForType(type: string): ConstructorOf<DataModel> | null;

    getInitialValue(data: unknown): TSourceProp;

    protected override _cleanType(
        value: unknown,
        options?: CleanFieldOptions
    ): MaybeSchemaProp<TSourceProp, true, false, true>;

    override initialize(
        value: string,
        model?: ConstructorOf<DataModel>
    ): MaybeSchemaProp<TModelProp, true, false, true>;

    toObject(value: TModelProp): TSourceProp;
}

/** A special `StringField` which records a standardized CSS color string. */
export class ColorField<
    TRequired extends boolean = false,
    TNullable extends boolean = true,
    THasInitial extends boolean = true
> extends StringField<HexColorString, HexColorString, TRequired, TNullable, THasInitial> {
    protected static override get _defaults(): StringFieldOptions<HexColorString, boolean, boolean, boolean>;

    protected override _validateType(value: unknown): boolean;
}

/**
 * @typedef FilePathFieldOptions
 * @property [categories]   A set of categories in CONST.FILE_CATEGORIES which this field supports
 * @property [base64=false] Is embedded base64 data supported in lieu of a file path?
 */
interface FilePathFieldOptions<
    TSourceProp extends FilePath,
    TRequired extends boolean,
    TNullable extends boolean,
    THasInitial extends boolean
> extends StringFieldOptions<TSourceProp, TRequired, TNullable, THasInitial> {
    categories?: FileCategory[];
    base64?: boolean;
}

/** A special `StringField` which records a file path or inline base64 data. */
export class FilePathField<
    TSourceProp extends FilePath = FilePath,
    TModelProp = TSourceProp,
    TRequired extends boolean = false,
    TNullable extends boolean = true,
    THasInitial extends boolean = true
> extends StringField<TSourceProp, TModelProp, TRequired, TNullable, THasInitial> {
    /** @param options  Options which configure the behavior of the field */
    constructor(options?: FilePathFieldOptions<TSourceProp, TRequired, TNullable, THasInitial>);

    protected static override get _defaults(): FilePathFieldOptions<FilePath, boolean, boolean, boolean>;

    protected override _validateType(value: unknown): void;
}

interface AngleFieldOptions<
    TSourceProp extends number,
    TRequired extends boolean,
    TNullable extends boolean,
    THasInitial extends boolean
> extends NumberFieldOptions<TSourceProp, TRequired, TNullable, THasInitial> {
    min?: number;
    max?: number;
    step?: number;
    integer?: boolean;
    base?: 360 | 0;
}

/**
 * A special `NumberField` which represents an angle of rotation in degrees between 0 and 360.
 * @property base Whether the base angle should be treated as 360 or as 0
 */
export class AngleField<
    TRequired extends boolean = true,
    TNullable extends boolean = false,
    THasInitial extends boolean = true
> extends NumberField<number, number, TRequired, TNullable, THasInitial> {
    protected static override get _defaults(): AngleFieldOptions<number, boolean, boolean, boolean>;

    protected override _cast(value: unknown): number;
}

/** A special `NumberField` represents a number between 0 and 1. */
export class AlphaField<
    TRequired extends boolean = true,
    TNullable extends boolean = false,
    THasInitial extends boolean = true
> extends NumberField<number, number, TRequired, TNullable, THasInitial> {
    protected static get _defaults(): NumberFieldOptions<number, boolean, boolean, boolean>;
}

/** A special `ObjectField` which captures a mapping of User IDs to Document permission levels. */
export class DocumentOwnershipField extends ObjectField<{ [K in string]?: DocumentOwnershipLevel }> {
    protected static override get _defaults(): ObjectFieldOptions<
        { [K in string]?: DocumentOwnershipLevel },
        true,
        false,
        true
    >;

    protected override _validateType(value: object): boolean | void;
}

/** A special [StringField]{@link StringField} which contains serialized JSON data. */
export class JSONField<
    TModelProp = object,
    TRequired extends boolean = false,
    TNullable extends boolean = false,
    THasInitial extends boolean = false
> extends StringField<string, TModelProp, TRequired, TNullable, THasInitial> {
    protected static override get _defaults(): StringFieldOptions<string, boolean, boolean, boolean>;

    override clean(
        value: unknown,
        options?: CleanFieldOptions
    ): MaybeSchemaProp<string, TRequired, TNullable, THasInitial>;

    protected override _validateType(value: unknown): boolean;

    override initialize(value: string): MaybeSchemaProp<TModelProp, TRequired, TNullable, THasInitial>;

    toObject(value: TModelProp): MaybeSchemaProp<string, TRequired, TNullable, THasInitial>;
}

/**
 * A subclass of [StringField]{@link StringField} which contains a sanitized HTML string.
 * This class does not override any StringField behaviors, but is used by the server-side to identify fields which
 * require sanitization of user input.
 */
export class HTMLField<
    TSourceProp extends string = string,
    TModelProp = TSourceProp,
    TRequired extends boolean = true,
    TNullable extends boolean = false,
    THasInitial extends boolean = true
> extends StringField<TSourceProp, TModelProp, TRequired, TNullable, THasInitial> {
    protected static override get _defaults(): StringFieldOptions<string, boolean, boolean, boolean>;
}

/** A subclass of `NumberField` which is used for storing integer sort keys. */
export class IntegerSortField<
    TRequired extends boolean = true,
    TNullable extends boolean = false,
    THasInitial extends boolean = true
> extends NumberField<number, number, TRequired, TNullable, THasInitial> {
    protected static override get _defaults(): NumberFieldOptions<number, boolean, boolean, boolean>;
}

/** @typedef DocumentStats
 * @property systemId       The package name of the system the Document was created in.
 * @property systemVersion  The version of the system the Document was created in.
 * @property coreVersion    The core version the Document was created in.
 * @property createdTime    A timestamp of when the Document was created.
 * @property modifiedTime   A timestamp of when the Document was last modified.
 * @property lastModifiedBy The ID of the user who last modified the Document.
 */

/**
 * A subclass of {@link SchemaField} which stores document metadata in the _stats field.
 * @mixes DocumentStats
 */
export class DocumentStatsField extends SchemaField<DocumentStatsSchema> {
    constructor(options?: ObjectFieldOptions<DocumentStatsSchema, true, false, true>);
}

type DocumentStatsSchema = {
    systemId: StringField<string, string, true, false, true>;
    systemVersion: StringField<string, string, true, false, true>;
    coreVersion: StringField<string, string, true, false, true>;
    createdTime: NumberField;
    modifiedTime: NumberField;
    lastModifiedBy: ForeignDocumentField<string>;
};

/* ---------------------------------------- */
/*  Errors                                  */
/* ---------------------------------------- */

/**
 * A special type of error that wraps multiple errors which occurred during DataModel validation.
 * @param errors  An array or object containing several errors.
 */
export class ModelValidationError extends Error {
    constructor(errors: Error | Error[] | string);

    errors: Error | Error[] | string;

    /**
     * Collect all the errors into a single message for consumers who do not handle the ModelValidationError specially.
     * @param errors The raw error structure
     * @returns A formatted error message
     */
    static formatErrors(errors: Error | Error[] | string): string;
}

// System utility types

export type SourcePropFromDataField<TDataField extends DataField> = TDataField extends SchemaField<
    infer _TSchemaDataSchema,
    infer TSchemaSourceProp,
    infer _TSchemaModelProp,
    infer TSchemaRequired,
    infer TSchemaNullable,
    infer TSchemaHasInitial
>
    ? MaybeSchemaProp<TSchemaSourceProp, TSchemaRequired, TSchemaNullable, TSchemaHasInitial>
    : TDataField extends DataField<
          infer TSourceProp,
          infer _TModelProp,
          infer TRequired,
          infer TNullable,
          infer THasInitial
      >
    ? MaybeSchemaProp<TSourceProp, TRequired, TNullable, THasInitial>
    : never;

export type ModelPropFromDataField<TDataField extends DataField> = TDataField extends SchemaField<
    infer _TSchemaDataSchema,
    infer _TSchemaSourceProp,
    infer TSchemaModelProp,
    infer TSchemaRequired,
    infer TSchemaNullable,
    infer TSchemaHasInitial
>
    ? MaybeSchemaProp<TSchemaModelProp, TSchemaRequired, TSchemaNullable, TSchemaHasInitial>
    : ReturnType<TDataField["initialize"]>;

type ModelPropsFromSchema<TDataSchema extends DataSchema> = {
    [K in keyof TDataSchema]: ModelPropFromDataField<TDataSchema[K]>;
};

export type MaybeSchemaProp<
    TProp,
    TRequired extends boolean,
    TNullable extends boolean,
    THasInitial extends boolean
> = TRequired extends true
    ? TNullable extends true
        ? TProp | null
        : TProp
    : TNullable extends true
    ? THasInitial extends true
        ? TProp | null
        : TProp | null | undefined
    : THasInitial extends true
    ? TProp
    : TProp | undefined;

declare global {
    type SourceFromSchema<TDataSchema extends DataSchema> = {
        [K in keyof TDataSchema]: SourcePropFromDataField<TDataSchema[K]>;
    };

    type HexColorString = `#${string}`;
    type AudioFilePath = `${string}.${AudioFileExtension}`;
    type ImageFilePath = `${string}.${ImageFileExtension}`;
    type VideoFilePath = `${string}.${VideoFileExtension}` | ImageFilePath;
    type FilePath = AudioFilePath | ImageFilePath | VideoFilePath;
}

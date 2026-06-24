import mongoose from "mongoose";
import { connectDB } from "./db.js";


await connectDB();
const client = mongoose.connection.getClient();

try {
  const db = mongoose.connection.db;
  await db.command({
    collMod: "users",
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: [
          '_id',
          'name',
          'email',
          'role',
          'rootDirId'
        ],
        properties: {
          _id: {
            bsonType: 'objectId'
          },
          name: {
            bsonType: 'string',
            minLength: 3
          },
          maxStorage: {
            bsonType: ["int", "long", "double"],
          },
          email: {
            bsonType: 'string',
            pattern: '^[a-zA-Z0-9._%+-]+@gmail.com$'
          },
          password: {
            bsonType: 'string',
            minLength: 6
          },
          role: {
            bsonType: "string",
            enum: ["user", "admin", "manager"],
          },
          picture: {
            bsonType: 'string'
          },
          rootDirId: {
            bsonType: 'objectId'
          }
        },
        additionalProperties: false
      }
    },
    validationAction: "error",
    validationLevel: "strict",
  });

  await db.command({
    collMod: "directories",
    validator: {
      $jsonSchema: {
        bsonType: "object",
        // Added "path" to the required list
        required: ["_id", "name", "size", "userId", "parentDirId", "createdAt", "updatedAt", "path"],
        properties: {
          _id: {
            bsonType: "objectId",
          },
          name: {
            bsonType: "string",
          },
          size: {
            // Changed to allow int, long (for >2GB), or double (JS default) 
            // to prevent validation errors on large files.
            bsonType: ["int", "long", "double"],
          },
          userId: {
            bsonType: "objectId",
          },
          parentDirId: {
            bsonType: ["objectId", "null"],
          },
          createdAt: {
            bsonType: "date",
          },
          updatedAt: {
            bsonType: "date",
          },
          // --- NEW FIELD: PATH ARRAY ---
          path: {
            bsonType: "array",
            items: {
              bsonType: "object",
              required: ["_id", "name"],
              properties: {
                _id: {
                  bsonType: "objectId",
                },
                name: {
                  bsonType: "string",
                },
              },
              additionalProperties: false, // Prevents extra junk data in path objects
            },
          },
        },
        additionalProperties: false,
      },
    },
    validationAction: "error",
    validationLevel: "strict",
  });

  await db.command({
    collMod: "files",
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["_id", "extension", "size", "name", "userId", "parentDirId", "createdAt", "updatedAt", "uploadStatus"],
        properties: {
          _id: {
            bsonType: "objectId",
          },
          name: {
            bsonType: "string",
          },
          size: {
            bsonType: "int",
          },
          extension: {
            bsonType: "string",
          },
          userId: {
            bsonType: "objectId",
          },
          parentDirId: {
            bsonType: "objectId",
          },
          uploadStatus: {
            bsonType: "string",
            enum: ["uploading", "uploaded", "failed"],
          },
          sharedWith: {
            bsonType: "array",
            items: {
              bsonType: "object",
              required: ["_id", "role"],
              properties: {
                _id: {
                  bsonType: "objectId"
                },
                role: {
                  bsonType: "string",
                  enum: ["viewer", "editor"],
                }
              }
            }
          },
          createdAt: {
            bsonType: "date",
          },
          updatedAt: {
            bsonType: "date",
          },
        },
        additionalProperties: false,
      },
    },
    validationAction: "error",
    validationLevel: "strict",
  });
} catch (error) {
  console.log("Error setting up the database Validation ", error);
} finally {
  await client.close();
}

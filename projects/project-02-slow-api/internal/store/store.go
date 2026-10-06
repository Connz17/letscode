package store

import (
	"database/sql"
	"fmt"
	"math/rand"
	"os"
	"path/filepath"
	"strings"

	_ "github.com/mattn/go-sqlite3"
)

func Open(path string) (*sql.DB, error) {
	if path != ":memory:" && path != "" {
		dir := filepath.Dir(path)
		if dir != "." && dir != "" {
			if err := os.MkdirAll(dir, 0o755); err != nil {
				return nil, fmt.Errorf("create database directory: %w", err)
			}
		}
	}
	db, err := sql.Open("sqlite3", path)
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS products (
		id INTEGER PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL,
		category TEXT NOT NULL, price REAL NOT NULL, stock INTEGER NOT NULL
	)`); err != nil {
		db.Close()
		return nil, fmt.Errorf("create schema: %w", err)
	}
	if _, err := db.Exec(`CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)`); err != nil {
		db.Close()
		return nil, fmt.Errorf("create products category index: %w", err)
	}
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS reviews (
		id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL, rating INTEGER NOT NULL,
		FOREIGN KEY (product_id) REFERENCES products(id)
	)`); err != nil {
		db.Close()
		return nil, fmt.Errorf("create reviews schema: %w", err)
	}
	if _, err := db.Exec(`CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews(product_id)`); err != nil {
		db.Close()
		return nil, fmt.Errorf("create reviews product index: %w", err)
	}
	return db, nil
}

func Seed(db *sql.DB, count int) error {
	var existing int
	if err := db.QueryRow("SELECT COUNT(*) FROM products").Scan(&existing); err != nil {
		return err
	}
	if existing >= count {
		return seedReviews(db, existing)
	}
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	stmt, err := tx.Prepare("INSERT INTO products (name, description, category, price, stock) VALUES (?, ?, ?, ?, ?)")
	if err != nil {
		tx.Rollback()
		return err
	}
	defer stmt.Close()
	categories := []string{"books", "electronics", "home", "outdoors", "office"}
	for i := existing; i < count; i++ {
		category := categories[i%len(categories)]
		if _, err := stmt.Exec(fmt.Sprintf("Product %04d", i+1),
			"A useful product for learning performance engineering", category,
			float64(10+rand.Intn(990))/10, rand.Intn(100)); err != nil {
			tx.Rollback()
			return err
		}
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	return seedReviews(db, count)
}

func seedReviews(db *sql.DB, count int) error {
	var existing int
	if err := db.QueryRow("SELECT COUNT(*) FROM reviews").Scan(&existing); err != nil {
		return err
	}
	if existing > 0 {
		return nil
	}
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	stmt, err := tx.Prepare("INSERT INTO reviews (product_id, rating) VALUES (?, ?)")
	if err != nil {
		tx.Rollback()
		return err
	}
	defer stmt.Close()
	for productID := 1; productID <= count; productID++ {
		for review := 0; review < 3; review++ {
			if _, err := stmt.Exec(productID, 3+(review%3)); err != nil {
				tx.Rollback()
				return err
			}
		}
	}
	return tx.Commit()
}

type Product struct {
	ID          int     `json:"id"`
	Name        string  `json:"name"`
	Description string  `json:"description"`
	Category    string  `json:"category"`
	Price       float64 `json:"price"`
	Stock       int     `json:"stock"`
	ReviewCount int     `json:"review_count"`
	AverageRating float64 `json:"average_rating"`
}

func FindProducts(db *sql.DB, category, search string) ([]Product, error) {
	query := `
		SELECT p.id, p.name, p.description, p.category, p.price, p.stock,
		       COUNT(r.id) AS review_count,
		       COALESCE(AVG(r.rating), 0) AS average_rating
		FROM products p
		LEFT JOIN reviews r ON r.product_id = p.id
		WHERE 1 = 1
	`
	args := []any{}

	if category != "" {
		query += " AND LOWER(category) = ?"
		args = append(args, strings.ToLower(category))
	}

	if search != "" {
		searchTerm := "%" + strings.ToLower(search) + "%"
		query += " AND (LOWER(p.name) LIKE ? OR LOWER(p.description) LIKE ?)"
		args = append(args, searchTerm, searchTerm)
	}

	query += " GROUP BY p.id, p.name, p.description, p.category, p.price, p.stock"

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var products []Product
	for rows.Next() {
		var p Product
		if err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.Category, &p.Price, &p.Stock, &p.ReviewCount, &p.AverageRating); err != nil {
			return nil, err
		}
		products = append(products, p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return products, nil
}

func FindProduct(db *sql.DB, id int) (Product, error) {
	var p Product
	err := db.QueryRow(`
		SELECT p.id, p.name, p.description, p.category, p.price, p.stock,
		       COUNT(r.id) AS review_count,
		       COALESCE(AVG(r.rating), 0) AS average_rating
		FROM products p
		LEFT JOIN reviews r ON r.product_id = p.id
		WHERE p.id = ?
		GROUP BY p.id, p.name, p.description, p.category, p.price, p.stock
	`, id).
		Scan(&p.ID, &p.Name, &p.Description, &p.Category, &p.Price, &p.Stock, &p.ReviewCount, &p.AverageRating)
	return p, err
}
